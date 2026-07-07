# Plan: User registration

Spec: specs/008-user-registration/spec.md

## 1. Bounded context

New context: **user** (`src/logic/user/`). This is the first feature that
touches accounts/credentials — no existing bounded context owns this concept
(the only context so far, `prompt`, owns `Prompt`/`PromptCategory` and has no
notion of an account holder). Per `hexagonal-architecture`'s "organized by
bounded contexts" principle, a genuinely new concept that shares no entities
or invariants with `prompt` gets its own context rather than being bolted onto
an unrelated one. This establishes the context's initial folder structure
(`domain/`, `application/`, `infrastructure/`, `services.ts`), mirroring how
`001-list-categories` established `prompt`'s.

Cross-context interactions: none. Registration reads and writes only the new
`User` entity; it does not reference `Prompt`/`PromptCategory` in either
direction.

## 2. Entities and value objects

**`User`** (new) — `src/logic/user/domain/User.ts`

| Field | Type | From spec | Invariants |
| --- | --- | --- | --- |
| id | `string` | spec §2 `id` | system-assigned, unique (§7 primary key) |
| name | `string` | spec §2 `name` | non-empty (V1) |
| email | `string` | spec §2 `email` | valid shape (V2); unique, compared case-insensitively (E1); stored/returned in the exact case supplied (AC9) |
| passwordHash | `string` | spec §2 `password` (never stored/returned in plain text — Decision #4) | never exposed outside this context; produced from the supplied plaintext password (V3) via the port in §3 |
| createdAt | `Date` | spec §2 `createdAt` | system-assigned |
| updatedAt | `Date` | spec §2 `updatedAt` | equals `createdAt` at creation |

```ts
export interface User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}
```

- `passwordHash` (not `password`) is the domain field name: the plaintext
  password (spec §2 `password`) never exists as a `User` field — the use case
  (§4) converts it to a hash before assembling the entity, so there is no
  domain-object shape that could accidentally leak the plaintext value in a
  response (spec AC1's "never includes the password").
- No `EmailAlreadyInUseError`-triggering invariant is enforced by the entity
  itself (entities are plain data, per `hexagonal-architecture`); uniqueness
  is enforced by the use case (§4) plus a defensive database constraint (§7).

**`EmailAlreadyInUseError`** (new) — `src/logic/user/domain/errors/EmailAlreadyInUseError.ts`

```ts
export class EmailAlreadyInUseError extends Error {
    constructor(email: string) {
        super(`Email already in use: ${email}`);
        this.name = 'EmailAlreadyInUseError';
    }
}
```

- A domain-specific error class per `coding-style`'s "throw domain-specific
  error classes" rule, mirroring `CategoryNotFoundError`
  (`005-create-prompt` plan.md §2). Carries the supplied email in its message
  for diagnosability, consistent with existing error-message precedent.
- Satisfies spec §4 E1 / AC8.

## 3. Ports

**`UserRepositoryInterface`** (new) — `src/logic/user/domain/interfaces/UserRepositoryInterface.ts`

```ts
import { type User } from '@logic/user/domain/User.js';

export default interface UserRepositoryInterface {
    findByEmail(email: string): Promise<User | undefined>;
    create(user: User): Promise<void>;
}
```

- `findByEmail()` matches case-insensitively (spec E1/AC8/AC9 — "Ada@Example.com"
  and "ada@example.com" are the same account); returns `undefined` when no
  account matches, modeling absence as `T | undefined` per `coding-style`,
  never a thrown error at the port level (mirrors
  `PromptCategoryRepositoryInterface.findById`, `005-create-prompt` plan.md
  §3).
- `create()` persists a fully-assembled `User`; returns `void` (the use case
  already holds the assembled entity in memory, §4), mirroring
  `PromptRepositoryInterface.create`.

**`PasswordHasherInterface`** (new) — `src/logic/user/domain/interfaces/PasswordHasherInterface.ts`

```ts
export default interface PasswordHasherInterface {
    hash(password: string): Promise<string>;
}
```

- New port: per Decision #4 (bcrypt), the concrete hashing library only
  appears in an infrastructure adapter (§7); the use case (§4) depends on this
  port, never on `bcrypt` directly, per `hexagonal-architecture`'s dependency
  rule (`infrastructure -> application -> domain`, ports at the domain
  boundary).
- Single `hash()` method only: registration never needs to verify a password
  against a stored hash, so a `compare()`/`verify()` method is not added here
  — a future login feature adds it to this same interface when needed (see
  §9 Assumption 2).

## 4. Use cases

**`RegisterUserUseCase`** (new) — `src/logic/user/application/RegisterUserUseCase.ts`

- Input: `RegisterUserQuery`.
- Output: `RegisterUserResponse` (a distinct type from `User`, per
  `hexagonal-architecture`'s Query/Response convention — deliberately omits
  `passwordHash`, satisfying spec AC1's "never includes the password" at the
  use-case boundary, not only at the route layer).
- Ports called: `UserRepositoryInterface.findByEmail()`,
  `PasswordHasherInterface.hash()`, `UserRepositoryInterface.create()`.
- AC satisfied: AC1 (assembles, hashes, and persists the account, returning
  the password-free response), AC8 (throws `EmailAlreadyInUseError` without
  persisting when `findByEmail` finds a match), AC9 (persists/returns the
  email exactly as supplied — no case normalization applied anywhere in this
  flow).

```ts
import { EmailAlreadyInUseError } from '@logic/user/domain/errors/EmailAlreadyInUseError.js';
import type PasswordHasherInterface from '@logic/user/domain/interfaces/PasswordHasherInterface.js';
import type UserRepositoryInterface from '@logic/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@logic/user/domain/User.js';

export interface RegisterUserQuery {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface RegisterUserResponse {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export class RegisterUserUseCase {
    constructor(
        private readonly userRepository: UserRepositoryInterface,
        private readonly passwordHasher: PasswordHasherInterface,
    ) {}

    public async invoke(query: RegisterUserQuery): Promise<RegisterUserResponse> {
        const existingUser = await this.userRepository.findByEmail(query.email);

        if (existingUser) {
            throw new EmailAlreadyInUseError(query.email);
        }

        const passwordHash = await this.passwordHasher.hash(query.password);

        const user: User = {
            id: query.id,
            name: query.name,
            email: query.email,
            passwordHash,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
        };

        await this.userRepository.create(user);

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
```

- Per `coding-style`'s "domain functions are pure — inject I/O, clock,
  randomness" rule, `id`/`createdAt`/`updatedAt` are generated by the caller
  (`RegisterUserHandler`, §5) and passed in on the query — mirrors
  `CreatePromptUseCase` (`005-create-prompt` plan.md §4).
- The existence check runs **before** hashing: hashing is the more expensive
  operation, and there's no reason to pay that cost for a request that will
  be rejected anyway (spec AC8 requires no account created, not "no work
  done", but this ordering is a reasonable, spec-consistent optimization —
  logged as an assumption, §9).

## 5. Routes

**`POST /users`**

- Request body: `{ name: string, email: string, password: string }`.
- Response `201`: JSON object `{ id, name, email, createdAt, updatedAt }`
  (spec AC1) — never a `password`/`passwordHash` field, since
  `RegisterUserResponse` (§4) has no such field to serialize.
- Response `400` (V1/V2/V3 — malformed request): body
  `{ message: string, errors: [{ field, error }] }`, via the existing shared
  `validateRequestMiddleware` (`004-request-validation-middleware`) — covers a
  missing/blank `name` (V1), a missing or malformed `email` (V2), and a
  missing or too-weak `password` (V3), including several at once (spec AC7).
- Response `409` (E1 — email already in use): body `{ error: string }` (e.g.
  `{ "error": "Email already in use: ada@example.com" }`). Deliberately `409
  Conflict`, not `400`: unlike `005-create-prompt`'s `CategoryNotFoundError`
  (a body field referencing something that doesn't exist, mapped to `400`
  per `write-operation-conventions`), this is the reverse shape — a body
  field colliding with something that already exists. `409` is the
  standard HTTP status for "the request conflicts with the current state of
  the resource" and is a plan-level decision explicitly deferred from spec.md
  (spec §6 Decision #2): no existing precedent in this codebase covers an
  "already exists" domain error, so this is the first one, and it
  establishes `409` as that precedent for future "already exists" checks.
- Handler: `src/handlers/RegisterUserHandler.ts` (default export, mirrors
  `CreatePromptHandler.ts`'s structure), reaching business logic only via
  `src/logic/user/services.ts`.
- Error mapping: handled locally inside `RegisterUserHandler.ts` via
  `try/catch` around `registerUserUseCase.invoke(...)` — catches
  `EmailAlreadyInUseError` specifically and responds `409` with its message;
  any other thrown error is re-thrown (not swallowed), matching
  `coding-style`'s "no swallowed catches" rule (no shared/global
  error-handling middleware exists in this codebase, per
  `004-request-validation-middleware` plan.md §3).

## 6. Validation schemas

**`RegisterUserSchema`** (new, Zod) — `src/schemas/RegisterUserSchema.ts`

```ts
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

const PASSWORD_REQUIREMENT_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
const PASSWORD_REQUIREMENT_MESSAGE =
    'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a digit, and a special character.';

export default {
    body: z.object({
        name: z
            .string({ error: 'Missing required value' })
            .refine((value) => value.trim().length > 0, { error: 'Missing required value' }),
        email: z.email({
            error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid email address'),
        }),
        password: z
            .string({ error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : undefined) })
            .regex(PASSWORD_REQUIREMENT_REGEX, { error: PASSWORD_REQUIREMENT_MESSAGE }),
    }),
} satisfies RequestSchema;
```

- `name`: `z.string(...).refine(trim().length > 0)` traces to V1 (required,
  non-empty **and** not blank — a plain `.min(1)` would accept a
  whitespace-only string, which spec §1's "or an empty one" / V1's "or blank"
  explicitly rejects).
- `email`: `z.email(...)` traces to V2 — the top-level Zod v4 email schema
  (mirrors `project-stack`'s `z.uuid()` guidance: use the top-level
  schema, not a deprecated `.string().email()` chain), with a branching
  `error` callback distinguishing "missing" from "malformed", mirroring
  `CreatePromptSchema.body.category_id`'s `z.uuid()` pattern
  (`005-create-prompt` plan.md §6).
- `password`: the `error` callback on `z.string(...)` handles the
  missing-value case (V3's "missing" branch, spec AC5); `.regex(...)` encodes
  V3's strength requirement in one combined pattern (spec AC6) — lookaheads
  for uppercase, lowercase, digit, and special character, plus an 8-character
  minimum, matching spec §6 Decision #1 exactly.
- Lives under `src/schemas/`, colocated with the other route schemas, per
  `middleware-infra`'s documented current layout.
- Consumed by `validateRequestMiddleware(RegisterUserSchema)` (§5); the
  handler reads the parsed value from `req.parsedRequest?.body`, mirroring
  `CreatePromptHandler.ts`.
- E1 (email already in use) is **not** expressible here: it's a business-rule
  check against existing data, not a shape check (same V#-vs-E# split as
  `005-create-prompt`'s `category_id`).

## 7. Persistence adapter

**Schema** (new) — `src/logic/user/infrastructure/database/schema.ts`

```ts
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable(
    'users',
    {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        email: text('email').notNull(),
        passwordHash: text('password_hash').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    },
    (table) => [uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`)],
);
```

- Table: `users`, plain plural per `database-modeling`'s naming convention
  (a standalone entity, not owned by another).
- `id`: `uuid` primary key, no `.defaultRandom()`, app-provided on insert per
  `database-modeling`'s Column conventions — mirrors every existing table.
- `password_hash` (not `password`): the column only ever holds the bcrypt
  hash produced by `BcryptPasswordHasher` (below), never plaintext.
- `created_at`/`updated_at`: `timestamptz`, app-provided, per
  `database-modeling`'s Datetime column conventions.
- `users_email_lower_unique`: a functional unique index on `lower(email)`,
  enforcing spec E1's case-insensitive uniqueness at the database as a
  defense-in-depth backstop behind the use case's `findByEmail` check (§4) —
  closes the race window between two concurrent registrations for the same
  email (see §9 Risk 1). The email column itself stays untouched
  (case-preserved, per AC9); only the index expression lowercases it.

**`DrizzleUserRepository`** (new) — `src/logic/user/infrastructure/database/DrizzleUserRepository.ts`

```ts
import { sql } from 'drizzle-orm';
import type UserRepositoryInterface from '@logic/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@logic/user/domain/User.js';
import { users } from '@logic/user/infrastructure/database/schema.js';
import { type DatabaseConnection } from '@logic/shared/database/DatabaseClient.js';

export class DrizzleUserRepository implements UserRepositoryInterface {
    constructor(private readonly db: DatabaseConnection) {}

    public async findByEmail(email: string): Promise<User | undefined> {
        const rows = await this.db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = lower(${email})`)
            .limit(1);

        const row = rows[0];

        if (!row) {
            return undefined;
        }

        return {
            id: row.id,
            name: row.name,
            email: row.email,
            passwordHash: row.passwordHash,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    public async create(user: User): Promise<void> {
        await this.db.insert(users).values({
            id: user.id,
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    }
}
```

- `findByEmail`'s `sql`lower(...) = lower(...)`` comparison mirrors the
  index expression above, satisfying spec E1/AC8/AC9's case-insensitive match
  while leaving the stored/returned `email` value's case untouched.
- Domain↔storage mapping is direct field-for-field; no nested/joined shape
  (unlike `Prompt`'s `category`), since `User` has no owned/referenced entity.

**`BcryptPasswordHasher`** (new) — `src/logic/user/infrastructure/BcryptPasswordHasher.ts`

```ts
import bcrypt from 'bcrypt';
import type PasswordHasherInterface from '@logic/user/domain/interfaces/PasswordHasherInterface.js';

const SALT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasherInterface {
    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }
}
```

- The only file in this context (or the codebase) that imports `bcrypt`,
  per `hexagonal-architecture`'s "infrastructure is the only place
  frameworks and libraries appear" rule.
- `SALT_ROUNDS = 10` per Decision #4 — a named constant, per
  `coding-style`'s "no magic numbers" rule, not inlined at the call site.

**Wiring:**

- `src/config.ts`: aggregate the new schema —
  `import * as userSchema from '@logic/user/infrastructure/database/schema.js';`
  and spread it into `database.schema` alongside `promptSchema`.
- `src/logic/user/services.ts` (new):

```ts
import { RegisterUserUseCase } from '@logic/user/application/RegisterUserUseCase.js';
import { BcryptPasswordHasher } from '@logic/user/infrastructure/BcryptPasswordHasher.js';
import { DrizzleUserRepository } from '@logic/user/infrastructure/database/DrizzleUserRepository.js';
import { databaseClient } from '@logic/shared/services.js';

const userRepository = new DrizzleUserRepository(databaseClient.connect());
const passwordHasher = new BcryptPasswordHasher();

export const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
```

- `src/app.ts`: add
  `app.post('/users', validateRequestMiddleware(RegisterUserSchema), registerUserHandler);`.

**Migrations** (per `database-modeling`, Drizzle Kit CLI, run manually):

1. `npx drizzle-kit generate` from the schema above to emit the `users`
   table-creation SQL (including the `users_email_lower_unique` index) into
   `drizzle/`.
2. `npx drizzle-kit migrate` to apply it.
3. Rollback: `DROP TABLE IF EXISTS users;` (also drops its index) — written
   by hand, since `drizzle-kit generate` only emits the forward (up) SQL, not
   a down script (mirrors `001-list-categories` plan.md §7's rollback note).

## 8. Dependency changes

- **INSTALL `bcrypt`** (`^6.0.0`) — the password-hashing library chosen in
  spec §6 Decision #4; no equivalent dependency exists yet.
- **INSTALL (dev) `@types/bcrypt`** (`^6.0.0`) — `bcrypt` ships no bundled
  TypeScript types; required to satisfy this project's `strict` TypeScript
  mode without `any`.

## 9. Assumptions and risks

**Assumptions**

1. Route is `POST /users` (plain plural resource, consistent with
   `POST /prompts`), not an action-style path like `POST /register` — no verb
   -style route exists anywhere else in this codebase, so registration is
   modeled as "create a user resource" like every other write endpoint. If
   wrong, only the route path/handler file name changes.
2. `PasswordHasherInterface` exposes only `hash()` (§3), not `compare()` —
   registration never needs to verify a password. If wrong (e.g. this port is
   meant to be shared with an imminent login feature), a `compare()` method
   is additive and doesn't change this feature's shape.
3. `EmailAlreadyInUseError`'s message format
   (`` `Email already in use: ${email}` ``) mirrors `CategoryNotFoundError`'s
   convention exactly (echoes the value that triggered it — safe here since
   the caller already supplied that same email in the request). If wrong,
   only the message string changes.
4. The existence check (`findByEmail`) runs before hashing the password (§4),
   purely as a cost-avoidance ordering, not a security requirement. If wrong,
   swapping the order changes nothing observable (AC8 is unaffected either
   way — no account is created and no work performed is exposed to the
   caller).
5. Handler/use-case/schema file names follow existing precedent exactly:
   `RegisterUserHandler.ts` mirrors `CreatePromptHandler.ts`;
   `RegisterUserUseCase.ts` mirrors `CreatePromptUseCase.ts`;
   `RegisterUserSchema.ts` mirrors `CreatePromptSchema.ts`. If wrong, only
   renames are needed.
6. `registerUserUseCase`'s constructor takes `userRepository` first, then
   `passwordHasher` — an arbitrary but fixed argument order. If wrong,
   trivial signature reorder.

**Risks**

1. _(low likelihood, medium impact)_ A race between two concurrent
   registrations for the same email (both pass the use case's `findByEmail`
   check before either `create()` completes) could otherwise create two
   accounts with the same email. Mitigation: the `users_email_lower_unique`
   database index (§7) rejects the second `INSERT` at the database level;
   this plan does not, however, specify translating that low-level database
   constraint violation into a friendly `EmailAlreadyInUseError`/`409` at the
   HTTP layer — an unhandled database error would surface as an unmapped
   `500` in that narrow race window. Accepted for this feature (out of scope
   per the story and given decisions); revisit if concurrent-registration
   collisions are observed in practice.
2. _(low likelihood, low impact)_ bcrypt's `SALT_ROUNDS = 10` (§7) is a fixed
   constant, not configurable via `src/config.ts`. Mitigation: acceptable per
   Decision #4's "e.g. 10 salt rounds" phrasing; revisit only if a future
   security review asks for a higher/tunable cost factor.
3. _(low likelihood, low impact)_ `z.email()`'s built-in shape check may
   accept or reject some edge-case address formats differently than a
   hand-rolled regex would. Mitigation: acceptable — spec V2 only requires
   "shaped like a valid email address", not a specific grammar; `z.email()`
   is Zod's own maintained implementation of that shape check.

## 10. Edge cases

- `name` missing entirely from the body → rejected as "Missing required
  value" (V1, AC2).
- `name` present but empty (`""`) or whitespace-only (`"   "`) → both rejected
  by the `.refine(trim().length > 0)` check (V1, AC2) — a plain `.min(1)`
  would only catch the former.
- `email` missing entirely → rejected as "Missing required value" (V2, AC3).
- `email` present but not shaped like an email (e.g. `"not-an-email"`) →
  rejected as "Invalid email address" (V2, AC4).
- `password` missing entirely → rejected as "Missing required value" (V3,
  AC5).
- `password` present but too short, or missing an uppercase letter, lowercase
  letter, digit, or special character → rejected with the password
  requirement message (V3, AC6).
- Several of the above at once (e.g. `name` and `password` both missing) →
  `RegisterUserSchema`'s combined Zod object schema reports every failing
  field together in one `errors` array (V1/V2/V3 combined, AC7).
- `email` already belongs to an existing account, same case
  (`"ada@example.com"` vs. `"ada@example.com"`) → `RegisterUserUseCase.invoke()`
  throws `EmailAlreadyInUseError`; `POST /users` responds `409` (E1, AC8); no
  row is inserted.
- `email` already belongs to an existing account, different case
  (`"Ada@Example.com"` vs. stored `"ada@example.com"`) → same as above, via
  the case-insensitive `findByEmail` match (E1, AC8).
- `email` contains uppercase letters but matches no existing account → the
  account is created; the response's `email` is exactly what was supplied,
  unchanged in case (AC9); no lowercasing happens anywhere in the write path.
- Successful registration → `createdAt` and `updatedAt` are equal in the
  response (assigned by `RegisterUserHandler` from the same `Date`
  instance/value, mirrors `CreatePromptHandler`); the response body has no
  `password`/`passwordHash` property at all (AC1).

## 11. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --- | --- |
| Field: name | `RegisterUserQuery.name`/`RegisterUserResponse.name` (§4); `RegisterUserSchema.body.name` (§6); `User.name` (§2); `users.name` column (§7) |
| Field: email | `RegisterUserQuery.email`/`RegisterUserResponse.email` (§4); `RegisterUserSchema.body.email` (§6); `User.email` (§2); `users.email` column + `users_email_lower_unique` index (§7) |
| Field: password | `RegisterUserQuery.password` (§4, plaintext, never persisted as-is); `RegisterUserSchema.body.password` (§6); `PasswordHasherInterface.hash` (§3); `User.passwordHash` (§2); `users.password_hash` column (§7) |
| Field: id | `RegisterUserQuery.id`, generated by `RegisterUserHandler` via `randomUUID()` (§5); `User.id` (§2); `users.id` column (§7) |
| Field: createdAt / updatedAt | `RegisterUserQuery.createdAt`/`.updatedAt`, generated by `RegisterUserHandler` via `new Date()` (§5); `users.created_at`/`.updated_at` columns (§7) |
| V1 (name required, non-blank) | `RegisterUserSchema.body.name` (§6); `400` mapping (§5); AC2 |
| V2 (email required, valid shape) | `RegisterUserSchema.body.email: z.email(...)` (§6); `400` mapping (§5); AC3, AC4 |
| V3 (password required, strength requirement) | `RegisterUserSchema.body.password` (§6); `400` mapping (§5); AC5, AC6 |
| E1 (email already in use) | `EmailAlreadyInUseError` (§2); `RegisterUserUseCase.invoke` throw (§4); `users_email_lower_unique` index (§7); `POST /users` `409` mapping (§5); AC8 |
| AC1 | `RegisterUserUseCase` (§4); `DrizzleUserRepository.create` (§7); `POST /users` `201` (§5) |
| AC2 | `RegisterUserSchema.body.name` (§6); `400` mapping (§5) |
| AC3 | `RegisterUserSchema.body.email` (§6); `400` mapping (§5) |
| AC4 | `RegisterUserSchema.body.email` (§6); `400` mapping (§5) |
| AC5 | `RegisterUserSchema.body.password` (§6); `400` mapping (§5) |
| AC6 | `RegisterUserSchema.body.password` (§6); `400` mapping (§5) |
| AC7 | `RegisterUserSchema`'s combined `z.object` (§6), reported via the existing `validateRequestMiddleware` combined-`errors` behavior |
| AC8 | `EmailAlreadyInUseError` (§2); `RegisterUserUseCase.invoke` throw (§4); `RegisterUserHandler` `try/catch` → `409` (§5) |
| AC9 | `DrizzleUserRepository.findByEmail`'s `lower(...)` comparison leaving `email` untouched (§7); `RegisterUserUseCase` passthrough (§4); `POST /users` response (§5) |
| Decision #4 (bcrypt, 10 salt rounds) | `PasswordHasherInterface`/`BcryptPasswordHasher` (§3, §7); §8 Dependency changes |
