# Plan: Login

Spec: specs/009-login/spec.md

## 1. Bounded context

New context: **auth** (`src/logic/auth/`), the third bounded context in this
codebase after `prompt` and `user`. Per the explicit user instruction, `auth`
is kept separate from `user` — `user` stays restricted to account/credential
storage and management (see `specs/008-user-registration`, frozen/
`IMPLEMENTED`), while `auth` owns the *act* of authenticating and issuing a
token. This mirrors the existing precedent
(`auth-and-new-context-conventions` memory) that a genuinely new concept with
no shared entities/invariants gets its own context, folder-structured
identically (`domain/`, `application/`, `infrastructure/`, `services.ts`).

**Revised cross-context stance (design correction from the first pass of this
plan):** `auth` does **not** call into `user` at all — not via `user`'s
`services.ts`, not via any new use case added to `user`. The user has
explicitly rejected the "auth calls a `user`-owned verification use case"
shape from the first pass of this plan (see spec §6 Decision #5). Instead:

- `auth` owns a **duplicated** read of the `users` table through its own
  port and its own infrastructure adapter — deliberate duplication, not a
  shortcut, so that `auth` has zero runtime dependency on `user`'s code.
- The one piece of logic that is genuinely identical for both contexts —
  wrapping bcrypt for hashing/verifying a password — is promoted to
  **`shared`** (`src/logic/shared/`), which is importable by any context
  under the boundaries-lint rules (see `boundaries_lint_cross_context`
  memory: `shared` is one of the plugin's four recognized element types, and
  any context may depend on it). Both `user` (hashing at registration) and
  `auth` (verifying at login) depend on this one shared piece — this is the
  single appropriate case of sharing here, unlike the "find a user" or
  "issue a token" concerns, which stay context-specific and duplicated.
- `user` therefore reverts to exactly its `008-user-registration` shape
  **except** that it no longer owns its own `PasswordHasherInterface`/
  `BcryptPasswordHasher` — those move to `shared`, and `user`'s
  `RegisterUserUseCase`/`services.ts` depend on the shared port/instance
  instead. `008`'s spec.md/plan.md/tasks.md remain untouched and historically
  accurate as originally authored; this plan documents the relocation since
  `009` is the feature causing it.

**Cross-context interaction:** none, in the "context calls another context's
use case" sense. `auth`'s only interaction with data outside its own context
is reading the physical `users` table directly through its own duplicated
schema/query, and depending on `shared` for the bcrypt wrapper and a new
Clock port (below) — never importing anything from `user`.

## 2. Entities and value objects

**`user` context (existing, reverted to 008 shape except the hasher move) —
`User` unchanged** (`src/logic/user/domain/User.ts`, already includes
`passwordHash`; see `specs/008-user-registration/plan.md` §2). Login
introduces no new field on `User`, and no new entity in `user`.

**`shared` context (new) — no entity, but a relocated port + a new port
(§3).**

**`auth` context (new) — no persisted entity.** `auth` holds no state of its
own; it duplicates a read of the `users` table plus issues a token. It needs
its own small value object carrying exactly what it read, kept private to
this context (never re-exported, never confused with `user`'s `User`):

`UserCredentials` (new) — `src/logic/auth/domain/UserCredentials.ts`

```ts
export interface UserCredentials {
    id: string;
    email: string;
    passwordHash: string;
}
```

- Deliberately a duplicate shape of (a subset of) `user`'s `User` — this is
  the point of the duplication directive: `auth` never imports `User` from
  `user`, it defines its own minimal read model for exactly the three
  columns it needs.

**`InvalidCredentialsError`** (new) — `src/logic/auth/domain/errors/InvalidCredentialsError.ts`

```ts
export class InvalidCredentialsError extends Error {
    constructor() {
        super('Invalid authentication credentials');
        this.name = 'InvalidCredentialsError';
    }
}
```

- A domain-specific error class per `coding-style`'s "throw domain-specific
  error classes" rule, mirroring `EmailAlreadyInUseError`
  (`008-user-registration` plan.md §2). Carries the fixed generic message —
  never the supplied email — since spec E1 requires the exact same wording
  for both the unknown-email and wrong-password cases.
- Satisfies spec §4 E1 / AC6 / AC7.
- Unchanged from the first pass of this plan — this correction only changes
  *how* the "no match" signal is produced, not the error itself.

## 3. Ports

**`shared` context — `PasswordHasherInterface`** (relocated from `user`,
extended) — `src/logic/shared/domain/interfaces/PasswordHasherInterface.ts`

```ts
export default interface PasswordHasherInterface {
    hash(password: string): Promise<string>;
    compare(password: string, hash: string): Promise<boolean>;
}
```

- Moved out of `user/domain/interfaces/` (its `008` location) into
  `shared/domain/interfaces/`, per the user's explicit directive: the
  bcrypt-wrapping logic is genuinely identical whether it's hashing
  (registration) or comparing (login), so it is the one case that earns a
  shared abstraction rather than duplication. `hexagonal-architecture`'s
  `shared` rule ("used by a single context? It belongs to that context, not
  here") no longer applies once a second context (`auth`) needs the exact
  same capability.
- The port lives under `shared`'s **own `domain/` layer**: the `shared`
  context is structured like every other bounded context and may hold a
  `domain/` with entities, errors, and interfaces of its own. This port is a
  domain interface, so it belongs in `shared/domain/interfaces/`, exactly as
  it did under `user/domain/interfaces/` in `008`. Its `BcryptPasswordHasher`
  adapter (§7) is the infrastructure implementation and lives under
  `shared/infrastructure/security/`, out of `domain/`.
- `compare()` is added here (it did not exist in `008`, where only `hash()`
  was needed) — this is the one place `compare()` lives; it is **not**
  re-added to a `user`-owned interface, correcting the first pass of this
  plan.

**`shared` context — `DateTimeInterface`** (new) — `src/logic/shared/utils/DateTimeInterface.ts`

```ts
export default interface DateTimeInterface {
    now(): Date;
}
```

- New port, placed in `shared` rather than `auth`: reading "the current
  time" is a cross-cutting infrastructure concern with no domain-specific
  meaning to any one context, unlike `PasswordHasherInterface` above, which
  is genuinely about a security concern shared by exactly two contexts. If a
  future context also needs injectable time, `shared` is already the right
  home. Logged as §9 Assumption 4 (a trivial placement choice).
- Exists so `LoginUseCase` (§4) never calls `new Date()` to read the current
  moment itself, per `coding-style`'s "domain functions are pure — inject
  I/O, clock, or randomness" rule, applied here to the application layer for
  the same reason (an unmocked, no-DI read of the current time in a use case
  is exactly the kind of hidden global call that rule forbids).

**`auth` context — `UserCredentialsRepositoryInterface`** (new) —
`src/logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.ts`

```ts
import { type UserCredentials } from '@logic/auth/domain/UserCredentials.js';

export default interface UserCredentialsRepositoryInterface {
    findByEmail(email: string): Promise<UserCredentials | undefined>;
}
```

- `auth`'s own port for its own duplicated read of the `users` table — no
  dependency on `user`'s `UserRepositoryInterface` or any of `user`'s code.
  Absence modeled as `undefined`, mirroring `UserRepositoryInterface
  .findByEmail`'s existing convention, but this is a structurally distinct
  interface owned entirely by `auth`.
- Replaces the first pass's `CredentialsVerifierInterface` (which wrapped a
  call into `user`) — this port only *reads*, it never verifies a password;
  password verification is now `AuthCryptoInterface`'s job (below), kept
  in `LoginUseCase` as a distinct step.

**`auth` context — `AuthCryptoInterface`** (new) —
`src/logic/auth/domain/interfaces/AuthCryptoInterface.ts`

```ts
export default interface AuthCryptoInterface {
    issueToken(userId: string, expiresAt: Date): Promise<string>;
    verifyPassword(password: string, passwordHash: string): Promise<boolean>;
}
```

- The **only** other port `auth` needs, per the user's explicit "only two
  ports/interfaces are needed in auth" directive: one interface covering
  both of `auth`'s crypto-ish operations (issuing a token, verifying a
  password hash), implemented by one adapter (§7) using `jsonwebtoken` +
  the shared `PasswordHasherInterface`. `LoginUseCase` (§4) depends on this
  port only, never on `jsonwebtoken` or bcrypt directly, per
  `hexagonal-architecture`'s dependency rule.
- `issueToken` takes an explicit `expiresAt: Date`, not a duration string —
  per the user's directive that the expiration is computed outside
  application/domain logic (via `DateTimeInterface`, in `LoginUseCase`) and
  passed in as a value, never left to `jsonwebtoken`'s implicit `expiresIn`.
- Name chosen (not source-referencing, per `hexagonal-architecture`'s "port
  name must not reference a source" rule) to describe the capability
  (auth-related crypto operations), not the library. Logged as §9
  Assumption 5 (trivial naming choice).

## 4. Use cases

**`RegisterUserUseCase`** (existing, `008`, unchanged in behavior) —
`src/logic/user/application/RegisterUserUseCase.ts`

- Only change: its `PasswordHasherInterface` type import now resolves to
  `@logic/shared/domain/interfaces/PasswordHasherInterface.js` instead of
  `@logic/user/domain/interfaces/PasswordHasherInterface.js` (§3). No change
  to its logic, `Query`/`Response` shapes, or the AC/E#/V# it satisfies
  (all owned by `008`, frozen). Not otherwise touched by this feature.

**`LoginUseCase`** (new) — `src/logic/auth/application/LoginUseCase.ts`

- Input: `LoginQuery { email: string; password: string }`.
- Output: `LoginResponse { token: string }`.
- Ports called: `UserCredentialsRepositoryInterface.findByEmail()`,
  `AuthCryptoInterface.verifyPassword()`, `AuthCryptoInterface.issueToken()`.
- Additional constructor dependencies: `DateTimeInterface` (to read "now"
  without calling `new Date()` itself) and `tokenExpirationSeconds: number`
  (the `.env`-sourced duration, injected as a plain value — see §7/§8).
- Logic: look up the credentials by email (case-insensitive, §7); if none,
  throw `InvalidCredentialsError` immediately (AC6). Otherwise verify the
  supplied password against the stored hash via `verifyPassword()`; if it
  does not match, throw `InvalidCredentialsError` (AC7). Otherwise compute
  `expiresAt` from `dateService.now() + tokenExpirationSeconds`, issue a token for
  that user id and expiry, and return it (AC1, AC2 — the case-insensitive
  match happens inside `findByEmail`, so no extra logic is needed here for
  AC2).
- AC satisfied: AC1, AC2, AC6, AC7.

```ts
import { InvalidCredentialsError } from '@logic/auth/domain/errors/InvalidCredentialsError.js';
import type AuthCryptoInterface from '@logic/auth/domain/interfaces/AuthCryptoInterface.js';
import type UserCredentialsRepositoryInterface from '@logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import type DateTimeInterface from '@logic/shared/utils/DateTimeInterface.js';

export interface LoginQuery {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
}

export class LoginUseCase {
    constructor(
        private readonly userCredentialsRepository: UserCredentialsRepositoryInterface,
        private readonly authCrypto: AuthCryptoInterface,
        private readonly dateService: DateTimeInterface,
        private readonly tokenExpirationSeconds: number,
    ) {}

    public async invoke(query: LoginQuery): Promise<LoginResponse> {
        const credentials = await this.userCredentialsRepository.findByEmail(query.email);

        if (!credentials) {
            throw new InvalidCredentialsError();
        }

        const passwordMatches = await this.authCrypto.verifyPassword(query.password, credentials.passwordHash);

        if (!passwordMatches) {
            throw new InvalidCredentialsError();
        }

        const expiresAt = new Date(this.dateService.now().getTime() + this.tokenExpirationSeconds * 1000);
        const token = await this.authCrypto.issueToken(credentials.id, expiresAt);

        return { token };
    }
}
```

- Per `coding-style`'s "no magic numbers/strings" and "inject I/O, clock, or
  randomness" rules, `tokenExpirationSeconds` and `dateService` are both
  constructor-injected, never read from `process.env` or `new Date()` inside
  this class.
- The `new Date(...)` call inside `invoke` is pure arithmetic on an
  already-injected `now` value (`dateService.now()`), not a hidden read of
  the current system time — it does not violate the "no `new Date()` in
  domain/application code" directive, which targets uninjected reads of
  *current* time, not deriving a value from one already passed in.

## 5. Routes

**`POST /authenticate`** — renamed from `POST /sessions`, and its success
status changed from `201` to `200` accordingly (§9 Assumption 1); no other
part of this route changed.

- Request body: `{ email: string, password: string }`.
- Response `200`: JSON object `{ token }` (spec AC1/AC2).
- Response `400` (V1/V2 — malformed request): body
  `{ message: string, errors: [{ field, error }] }`, via the existing shared
  `validateRequestMiddleware` — covers a missing `email` (V1) and/or a
  missing `password` (V2), including both at once (spec AC5).
- Response `401` (E1 — invalid credentials): body
  `{ error: "Invalid authentication credentials" }`.
- Handler: `src/handlers/LoginHandler.ts` (default export, mirrors
  `RegisterUserHandler.ts`'s structure), reaching business logic only via
  `src/logic/auth/services.ts`.
- Error mapping: handled locally inside `LoginHandler.ts` via `try/catch`
  around `loginUseCase.invoke(...)` — catches `InvalidCredentialsError`
  specifically and responds `401` with its message; any other thrown error
  is re-thrown (not swallowed), matching `RegisterUserHandler`'s existing
  pattern.

## 6. Validation schemas

**`LoginSchema`** (new, Zod) — `src/schemas/LoginSchema.ts`

```ts
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    body: z.object({
        email: z.email({ error: 'Missing required value' }),
        password: z.string({ error: 'Missing required value' }),
    }),
} satisfies RequestSchema;
```

- `email`: required and validated as a well-formed email shape via `z.email`
  (V1, AC3) — a correction from this plan's first pass, which used a bare
  `z.string()` (type-presence only) for anti-enumeration reasons. The
  anti-enumeration concern (not revealing whether an email is registered)
  is about E1's *response*, not the request shape check: rejecting a
  syntactically invalid email with `400` reveals nothing about which
  accounts exist, so `z.email` is safe to use here.
- `password`: required (type presence only) — trace to V2, deliberately with
  no shape/strength check (unaffected by this correction).
- Lives under `src/schemas/`, alongside `RegisterUserSchema.ts`.
- Consumed by `validateRequestMiddleware(LoginSchema)` (§5); the handler
  reads the parsed value from `req.parsedRequest?.body`.
- E1 is not expressible here — a business-rule check, not a shape check.

## 7. Persistence adapter

No new tables and no migration. `auth` is stateless — it reads the existing
`users` table (owned/migrated by `user`, per `008`) through its **own**
duplicated table definition and query, never through `user`'s repository or
schema module, and issues a token that is never persisted.

**Relocation — `PasswordHasherInterface` / `BcryptPasswordHasher`** (moved
from `user` to `shared`, extended with `compare()`):

`src/logic/shared/infrastructure/security/BcryptPasswordHasher.ts`

```ts
import bcrypt from 'bcrypt';
import type PasswordHasherInterface from '@logic/shared/domain/interfaces/PasswordHasherInterface.js';

export class BcryptPasswordHasher implements PasswordHasherInterface {
    private static readonly SALT_ROUNDS = 10;

    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, BcryptPasswordHasher.SALT_ROUNDS);
    }

    public async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}
```

- This is a **move**, not a copy: `src/logic/user/domain/interfaces/
  PasswordHasherInterface.ts` and `src/logic/user/infrastructure/
  BcryptPasswordHasher.ts` (both created and already implemented in `008`)
  are deleted; the class body is otherwise unchanged except for the added
  `compare()` method and its new import path. `008`'s plan.md text is left
  untouched (frozen historical record of the design *as originally
  implemented*); this paragraph is the authoritative record of where the
  code actually lives after `009`.
- `SALT_ROUNDS` stays a `private static readonly` class constant per
  `coding-style`.

**`DateTimeService`** (new) — `src/logic/shared/utils/DateTimeService.ts`

```ts
import type DateTimeInterface from '@logic/shared/utils/DateTimeInterface.js';

export class DateTimeService implements DateTimeInterface {
    public now(): Date {
        return new Date();
    }
}
```

- The **only** file in the codebase allowed to call `new Date()` to read the
  current moment — every consumer goes through `DateTimeInterface.now()`.

**No new schema file.** `auth` does **not** define its own `users` table.
`user`'s `users` table (`008` plan.md §7,
`src/logic/user/infrastructure/database/schema.ts`) remains the single
definition, owned and migrated exclusively by `user`, per
`database-modeling`'s "one table per entity, defined in its bounded
context's `schema.ts`" rule — duplicating it (as an earlier pass of this
plan did, under a distinct `authUsers` export) was rejected: every
context's schema is already aggregated into one object at the composition
root (`src/config.ts`'s `database.schema`), and `databaseClient`
(`src/logic/shared/services.ts`) is generically typed over that full
aggregate (`DatabaseClient<typeof config.database.schema>`). That means
any repository holding a connection typed against the full aggregate
already has type-safe access to every context's tables via Drizzle's
relational query API (`db.query.<table>`), with no table object to import
and no risk of two JS objects drifting out of sync against the same
physical table.

**`DrizzleUserCredentialsRepository`** (new) —
`src/logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts`

```ts
import type UserCredentialsRepositoryInterface from '@logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import { type UserCredentials } from '@logic/auth/domain/UserCredentials.js';
import { type DatabaseConnection } from '@logic/shared/database/DatabaseClient.js';
import type config from '@src/config.js';

export class DrizzleUserCredentialsRepository implements UserCredentialsRepositoryInterface {
    constructor(private readonly db: DatabaseConnection<typeof config.database.schema>) {}

    public async findByEmail(email: string): Promise<UserCredentials | undefined> {
        const row = await this.db.query.users.findFirst({
            where: (users, { sql }) => sql`lower(${users.email}) = lower(${email})`,
        });

        if (!row) {
            return undefined;
        }

        return { id: row.id, email: row.email, passwordHash: row.passwordHash };
    }
}
```

- `auth`'s own adapter — no import of `user`'s repository, entity, or
  `services.ts`, and (per the correction above) no import of `user`'s
  schema either. It reaches the physical `users` table only through the
  shared, fully-typed connection's `.query.users` accessor, which Drizzle
  populates from the schema already passed to `drizzle()` at construction
  (`src/logic/shared/services.ts`) — no new dependency edge, no
  duplicated table shape to keep in sync. This replaces both the first
  pass's `UserCredentialsVerifierAdapter` (which called into
  `user/services.ts`) and this pass's earlier `authUsers`-duplicating
  version.
- Only a type-only import of `config` (`@src/config.js`) is added, solely
  to name the connection's generic schema parameter; `infrastructure ->
  config` is an explicitly allowed boundary edge (unlike
  `infrastructure -> another context's infrastructure`, which stays
  disallowed).

**`JwtAuthCryptoAdapter`** (new) — `src/logic/auth/infrastructure/JwtAuthCryptoAdapter.ts`

```ts
import jwt from 'jsonwebtoken';
import type AuthCryptoInterface from '@logic/auth/domain/interfaces/AuthCryptoInterface.js';
import type PasswordHasherInterface from '@logic/shared/domain/interfaces/PasswordHasherInterface.js';

export class JwtAuthCryptoAdapter implements AuthCryptoInterface {
    private static readonly ALGORITHM = 'HS256';

    constructor(
        private readonly secret: string,
        private readonly passwordHasher: PasswordHasherInterface,
    ) {}

    public async issueToken(userId: string, expiresAt: Date): Promise<string> {
        return jwt.sign({ sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) }, this.secret, {
            algorithm: JwtAuthCryptoAdapter.ALGORITHM,
        });
    }

    public async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
        return this.passwordHasher.compare(password, passwordHash);
    }
}
```

- The only file in this context that imports `jsonwebtoken`, per
  `hexagonal-architecture`'s "infrastructure is the only place frameworks/
  libraries appear" rule. It does **not** import `bcrypt` directly — it
  delegates `verifyPassword` to the injected shared `PasswordHasherInterface`
  (§3), which is the one piece of logic `auth` and `user` share, per the
  user's explicit directive.
  `exp` is set explicitly on the payload (a unix-seconds timestamp derived
  from the caller-supplied `expiresAt`), and `expiresIn` is deliberately
  **not** passed to `jwt.sign` — `jsonwebtoken` throws if both are set, and
  the whole point of this correction is that the expiration is computed
  outside this adapter (in `LoginUseCase`, from an injected `Clock` +
  `.env`-sourced duration), not left to the library's implicit string
  option.
- `ALGORITHM` is a named constant per `coding-style`'s "no magic numbers/
  strings" rule.
- `secret` is injected via the constructor (never reads `process.env`
  itself), consistent with CLAUDE.md's "`process.env` is read only in
  `src/config.ts`" rule.

**Config (existing, extended)** — `src/config.ts` adds two new fields:

```ts
jwtSecret: process.env.JWT_SECRET ?? '',
jwtExpirationSeconds: Number(process.env.JWT_EXPIRATION_SECONDS ?? 3600),
```

- `JWT_EXPIRATION_SECONDS` is the new `.env` var the user's directive calls
  for; defaults to `3600` (one hour), matching the duration already agreed
  in spec §6 Decision #3 (kept as a value now, not a hardcoded string
  constant in an adapter). Read exclusively here, per CLAUDE.md.

**Wiring:**

- `src/logic/shared/services.ts` (extended) — becomes the shared
  instantiation point for the newly-shared pieces, mirroring how it already
  centralizes `databaseClient`:

```ts
import DatabaseClient from '@logic/shared/database/DatabaseClient.js';
import { BcryptPasswordHasher } from '@logic/shared/infrastructure/security/BcryptPasswordHasher.js';
import { DateTimeService } from '@logic/shared/utils/DateTimeService.js';
import config from '@src/config.js';

export const databaseClient = new DatabaseClient<typeof config.database.schema>(
    config.database,
    config.database.schema,
);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();
```

- `src/logic/user/services.ts` (updated — no longer instantiates its own
  hasher):

```ts
import { RegisterUserUseCase } from '@logic/user/application/RegisterUserUseCase.js';
import { DrizzleUserRepository } from '@logic/user/infrastructure/database/DrizzleUserRepository.js';
import { databaseClient, passwordHasher } from '@logic/shared/services.js';

const userRepository = new DrizzleUserRepository(databaseClient.connect());

export const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
```

- `src/logic/auth/services.ts` (new):

```ts
import { LoginUseCase } from '@logic/auth/application/LoginUseCase.js';
import { DrizzleUserCredentialsRepository } from '@logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import { JwtAuthCryptoAdapter } from '@logic/auth/infrastructure/JwtAuthCryptoAdapter.js';
import { databaseClient, passwordHasher, dateTimeService } from '@logic/shared/services.js';
import config from '@src/config.js';

const userCredentialsRepository = new DrizzleUserCredentialsRepository(databaseClient.connect());
const authCrypto = new JwtAuthCryptoAdapter(config.jwtSecret, passwordHasher);

export const loginUseCase = new LoginUseCase(
    userCredentialsRepository,
    authCrypto,
    dateTimeService,
    config.jwtExpirationSeconds,
);
```

- `src/app.ts`: add
  `app.post('/authenticate', validateRequestMiddleware(LoginSchema), loginHandler);`.

**Migrations:** none — no schema change in this feature; `auth`'s duplicated
table definition (above) is a read-only query-building convenience, not a
migrated artifact.

## 8. Dependency changes

- **INSTALL `jsonwebtoken`** (`^9.0.2`) — the JWT library chosen in spec §6
  Decision #3; no equivalent dependency exists yet.
- **INSTALL (dev) `@types/jsonwebtoken`** (`^9.0.7`) — `jsonwebtoken` ships no
  bundled TypeScript types; required to satisfy this project's `strict`
  TypeScript mode without `any`.
- `bcrypt`/`@types/bcrypt` (already installed by `008`) are unaffected —
  this feature relocates their one consumer file, it does not add a second
  dependency.

## 9. Assumptions and risks

**Assumptions**

1. Route is `POST /authenticate`, `200` on success (§5) — renamed from the
   original `POST /sessions`/`201` design at the user's explicit request:
   `/authenticate` is an action/RPC-style endpoint rather than a resource
   being created, so `200` (a result returned) fits better than `201` (a
   resource created).
2. `email` on `LoginSchema` (§6) is validated as a well-formed email via
   `z.email` (a correction from the first pass, which used type-presence
   only); `password` remains type-presence only. If wrong, reverting `email`
   to `z.string()` is a one-line change with no other structural impact.
3. File/class naming otherwise mirrors existing precedent: `LoginHandler`
   mirrors `RegisterUserHandler`; `LoginUseCase`/`LoginSchema`/`LoginQuery`/
   `LoginResponse` mirror the `RegisterUser*` family. If wrong, only renames
   are needed.
4. `DateTimeInterface`/`DateTimeService` live in `shared` (`shared/utils/`), not in
   `auth`, since "the current time" has no context-specific meaning and a
   future context may need it too. If wrong (this codebase later decides
   time-related ports belong per-context), moving the two files is a
   mechanical change with no behavior impact.
5. `AuthCryptoInterface`'s method names (`issueToken`, `verifyPassword`) and
   the adapter name `JwtAuthCryptoAdapter` are this plan's own choice, per
   the user's explicit "design the interface and method names as you see
   fit" instruction. If wrong, a rename with no structural impact.
6. `auth` reads the `users` table via the shared connection's
   `db.query.users` accessor rather than importing `user`'s schema object
   (§7) — this relies on `DrizzleUserCredentialsRepository` being
   constructed with a connection typed against the full aggregate schema
   (`DatabaseConnection<typeof config.database.schema>`), not the untyped
   default. If wrong (some future refactor narrows what schema type
   `auth`'s wiring passes), the fix is a type-parameter change at the
   composition root only — no query logic changes.
7. `JWT_EXPIRATION_SECONDS` defaults to `3600` (one hour) when unset,
   matching the duration already agreed in spec §6 Decision #3, now
   expressed as a configurable number instead of a hardcoded adapter
   constant. If wrong, a config default change only.
8. `config.jwtSecret` still defaults to `''` when `JWT_SECRET` is unset,
   mirroring this codebase's existing no-fail-fast convention for every
   other env var (unchanged from the first pass; see that pass's Risk 2,
   restated below).
9. `LoginUseCase`'s constructor order (`userCredentialsRepository`,
   `authCrypto`, `dateService`, `tokenExpirationSeconds`) is arbitrary but fixed —
   ports first, then the plain injected value, mirroring
   `RegisterUserUseCase`'s "port objects first" shape. If wrong, trivial
   signature reorder.

**Risks**

1. _(low likelihood, low impact)_ `jsonwebtoken`'s synchronous `sign()` call
   briefly blocks the event loop. Mitigation: the signed payload is tiny,
   the blocking window is negligible.
2. _(low likelihood, medium impact)_ An unset `JWT_SECRET` would let
   `jsonwebtoken` sign tokens with an empty-string secret. Mitigation:
   accepted per Assumption 8 (matches this codebase's existing convention);
   out of scope for this feature.
3. _(medium likelihood, medium impact)_ The generic invalid-credentials
   message (E1) is applied uniformly, but the unknown-email path in
   `LoginUseCase` returns before ever calling `verifyPassword()` while the
   wrong-password path calls it — a measurable timing difference that could
   leak whether an email is registered via a timing attack, even though the
   response body is identical. Mitigation: accepted as out of scope for this
   feature (unchanged from the first pass); revisit with a dummy-hash
   `verifyPassword()` call on the unknown-email path if later flagged.
4. _(low likelihood, low impact)_ `auth`'s `db.query.users` field access
   (`row.id`/`row.email`/`row.passwordHash` in §7) is only checked by
   TypeScript against `user`'s real `users` columns because both contexts'
   repositories are built on the one aggregated schema type — there is no
   second table object to drift out of sync (this replaces the prior draft's
   duplicated-schema risk entirely, not just its mitigation).

## 10. Edge cases

- `email` missing entirely from the body → rejected as "Missing required
  value" (V1, AC3).
- `password` missing entirely from the body → rejected as "Missing required
  value" (V2, AC4).
- Both `email` and `password` missing → `LoginSchema`'s combined Zod object
  schema reports both fields together in one `errors` array (V1+V2, AC5).
- `email` present but not shaped like an email at all, or blank (`""`) →
  rejected as `400` by `LoginSchema`'s `z.email` check (V1) — a correction
  from the first pass, where this fell through to the generic `401` (E1).
  `email` well-formed but simply unregistered still falls through to `401`
  (below).
- `password` present but blank (`""`) → no `400`; `verifyPassword()` simply
  fails to match any real hash, falling through to the generic `401` (E1).
- `email` well-formed but does not match any existing account →
  `LoginUseCase` throws `InvalidCredentialsError` immediately (no
  `verifyPassword()` call at all) → `401` with the generic message (E1, AC6);
  no timing-safe guarantee is made (Risk 3).
- `email` matches an existing account (same case) but `password` is wrong →
  `verifyPassword()` resolves `false` → `401` with the exact same generic
  message (E1, AC7).
- `email` matches an existing account when compared case-insensitively (e.g.
  stored `"ada@example.com"`, supplied `"Ada@Example.com"`) and the password
  is correct → `200` with a token, via `DrizzleUserCredentialsRepository`'s
  own `lower(...)` comparison (AC2) — independent of, but mirroring,
  `user`'s existing `findByEmail` case-insensitive match (`008`).
- Successful login → response body is exactly `{ token }`; no `id`, `name`,
  `email`, or any other account field is present (AC1).
- A generated token, decoded, has `sub` equal to the authenticated account's
  `id` and an `exp` claim equal to `dateService.now() + tokenExpirationSeconds`,
  computed once inside `LoginUseCase`, not inside the JWT adapter or the
  library's own `expiresIn` handling.
- `user`'s `RegisterUserUseCase` (`008`, unaffected in behavior) now resolves
  its `PasswordHasherInterface` from `shared` — a registration request
  behaves identically to before; only the import path/wiring changed.

## 11. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --- | --- |
| Field: email | `LoginQuery.email` (§4); `LoginSchema.body.email` (§6); `UserCredentials.email` / `UserCredentialsRepositoryInterface.findByEmail` (§2, §3); `DrizzleUserCredentialsRepository` (§7) |
| Field: password | `LoginQuery.password` (§4); `LoginSchema.body.password` (§6); `AuthCryptoInterface.verifyPassword` / shared `PasswordHasherInterface.compare` (§3, §7) |
| Field: token | `LoginResponse.token` (§4); `AuthCryptoInterface.issueToken` / `JwtAuthCryptoAdapter` (§3, §7); `POST /authenticate` `200` body (§5) |
| V1 (email required) | `LoginSchema.body.email` (§6); `400` mapping (§5); AC3 |
| V2 (password required) | `LoginSchema.body.password` (§6); `400` mapping (§5); AC4 |
| E1 (invalid email or password) | `InvalidCredentialsError` (§2); `UserCredentialsRepositoryInterface` returning `undefined` / `AuthCryptoInterface.verifyPassword` returning `false` (§3); `LoginUseCase.invoke` throw (§4); `POST /authenticate` `401` mapping (§5); AC6, AC7 |
| AC1 | `LoginUseCase` (§4); `DrizzleUserCredentialsRepository` (§7); `JwtAuthCryptoAdapter.issueToken` (§7); `POST /authenticate` `200` (§5) |
| AC2 | `DrizzleUserCredentialsRepository.findByEmail`'s `lower(...)` match (§7); `POST /authenticate` `200` (§5) |
| AC3 | `LoginSchema.body.email` (§6); `400` mapping (§5) |
| AC4 | `LoginSchema.body.password` (§6); `400` mapping (§5) |
| AC5 | `LoginSchema`'s combined `z.object` (§6), reported via the existing `validateRequestMiddleware` combined-`errors` behavior |
| AC6 | `DrizzleUserCredentialsRepository.findByEmail` returning `undefined` (§7); `InvalidCredentialsError` (§2); `LoginUseCase.invoke` throw (§4); `LoginHandler` `try/catch` → `401` (§5) |
| AC7 | `AuthCryptoInterface.verifyPassword` returning `false` (§3, §7); `InvalidCredentialsError` (§2); `LoginUseCase.invoke` throw (§4); `LoginHandler` `try/catch` → `401` (§5) |
| Decision #3 (jsonwebtoken, HS256, 1h duration) | `AuthCryptoInterface`/`JwtAuthCryptoAdapter` (§3, §7); `config.jwtExpirationSeconds` default (§7, §9 Assumption 7); §8 Dependency changes |
| Decision #4 (generic invalid-credentials message) | `InvalidCredentialsError` (§2); E1 mapping (§5) |
| Decision #5 (this correction: no `user` call from `auth`; shared bcrypt; auth-owned duplicated read; Clock + `.env`-sourced expiration injected into `LoginUseCase`) | §1 Bounded context; §2 `UserCredentials`; §3 all four ports; §4 `LoginUseCase`; §7 all of Persistence adapter |
