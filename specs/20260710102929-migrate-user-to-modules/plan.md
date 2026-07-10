# Plan: Rebuild the user registration capability in the current module structure
Spec: specs/20260710102929-migrate-user-to-modules/spec.md

## 1. Approach

Create a new `user` bounded context at `src/modules/user/` following the
`domain-driven-design` skill's structure and the exact conventions already established by
the rebuilt `src/modules/prompt/` context, by **porting** the legacy `src/logic/user/`
files into the correct layer folders and adjusting them to current guidelines:

- The `User` entity, the `UserRepositoryInterface` contract, and the
  `EmailAlreadyInUseError` domain error are ported essentially unchanged (the entity moves
  from `interface` to `export type` to match the prompt module's entity style — Decision-
  logged assumption).
- `RegisterUserUseCase` is adjusted so it **injects the shared current-time and
  unique-identifier providers** (`DateTimeInterface`, `IdGeneratorInterface`) and produces
  the account's `id`, `createdAt`, and `updatedAt` itself. `RegisterUserQuery` drops those
  three externally supplied fields; `RegisterUserResponse` is unchanged (Decision 2). This
  mirrors `src/modules/prompt/application/CreatePromptUseCase.ts` exactly.
- `DrizzleUserRepository` is adjusted to the current persistence convention: it takes a
  `DatabaseClientInterface<DatabaseConnection>` and calls `getConnection()` per query,
  instead of receiving a raw connection (mirrors
  `src/modules/prompt/infrastructure/database/DrizzlePromptRepository.ts`, per the
  `database-client-connect-at-boot` change).
- The Drizzle `users` table schema is ported unchanged (same table/column names, types,
  and the case-insensitive unique email index).
- A single `src/modules/user/services.ts` composition root wires the repository and use
  case from the shared singletons (`databaseClient`, `passwordHasher`, `dateTimeService`,
  `idGenerator`) exported by `@src/modules/shared/services.js`.

The legacy `src/logic/user/**`, the `src/handlers/RegisterUserHandler.ts` request edge,
the legacy `src/logic/auth/**` context (which reads the `users` records via the aggregated
relational schema), and `src/config.ts` are left **unchanged** (Decision 1). The new
context is not yet wired into the request edge — it is the verified foundation for a later
cutover spec. No new architecture-boundary configuration is required: `.eslintrc.json`
already matches `src/modules/*/{domain,application,infrastructure}`.

New tests are authored at the mirrored `tests/**/modules/user/**` paths, ported from the
legacy tests and re-pointed to the new import paths, each written **before** the file it
exercises (test-first). The existing `UserModelFactory` and `tests/lib/database/users.ts`
helpers are reused as-is (they describe account rows, which are unchanged).

Reused verbatim (shared, already present — no change):
- `src/modules/shared/domain/interfaces/DateTimeInterface.ts`, `IdGeneratorInterface.ts`,
  `PasswordHasherInterface.ts`
- `src/modules/shared/services.ts` singletons `databaseClient`, `passwordHasher`,
  `dateTimeService`, `idGenerator`, and the exported `DatabaseConnection` type.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `User` entity | new (port) | `src/modules/user/domain/User.ts` | Ported from `src/logic/user/domain/User.ts`; declared as `export type User` (was `interface`) to match the prompt module's entity style. Same fields. |
| `EmailAlreadyInUseError` | new (port) | `src/modules/user/domain/errors/EmailAlreadyInUseError.ts` | Ported unchanged from legacy (extends `Error`, sets `name`, message `Email already in use: <email>`). |
| `UserRepositoryInterface` (port) | new (port) | `src/modules/user/domain/interfaces/UserRepositoryInterface.ts` | Ported unchanged: default-export `interface` with `findByEmail(email): Promise<User \| undefined>` and `create(user): Promise<void>`. |
| `RegisterUserUseCase` (+ `RegisterUserQuery`, `RegisterUserResponse`) | new (adjusted) | `src/modules/user/application/RegisterUserUseCase.ts` | Constructor gains `DateTimeInterface` + `IdGeneratorInterface`; `RegisterUserQuery` drops `id`/`createdAt`/`updatedAt` (keeps `name`, `email`, `password`); the use case self-assigns `id = idGenerator.generate()` and `createdAt = updatedAt = dateTime.now()`. `RegisterUserResponse` unchanged. |
| `users` Drizzle schema | new (port) | `src/modules/user/infrastructure/database/schema.ts` | Ported unchanged from `src/logic/user/infrastructure/database/schema.ts` (same table/column names, `lower(email)` unique index). |
| `DrizzleUserRepository` | new (adjusted) | `src/modules/user/infrastructure/database/DrizzleUserRepository.ts` | Constructor takes `DatabaseClientInterface<DatabaseConnection>`; each method calls `this.database.getConnection()`; query bodies (`lower(email)` match, insert) unchanged. Imports `DatabaseConnection` from `@src/modules/shared/services.js`. |
| `services.ts` (composition root) | new | `src/modules/user/services.ts` | `new DrizzleUserRepository(databaseClient)`, `new RegisterUserUseCase(userRepository, passwordHasher, dateTimeService, idGenerator)`; exports `registerUserUseCase`. All collaborators imported from `@src/modules/shared/services.js`. |
| `RegisterUserUseCase` unit test | new (port) | `tests/unit/modules/user/application/RegisterUserUseCase.test.ts` | Ported from the legacy unit test, substantively adjusted: also mocks `DateTimeInterface` + `IdGeneratorInterface`; `buildQuery()` drops `id`/`createdAt`/`updatedAt`; asserts the returned account and the `create` call use the mocked generator's id and the mocked clock's time for both `createdAt` and `updatedAt`. |
| `DrizzleUserRepository` integration test | new (port) | `tests/integration/modules/user/infrastructure/database/DrizzleUserRepository.test.ts` | Ported from the legacy integration test, re-pointed; builds a `DatabaseClient` locally and passes the **client** to the repository (mirrors `DrizzlePromptRepository.test.ts`). |

Legacy files under `src/logic/user/**`, `src/logic/auth/**`, `src/handlers/**`,
`src/config.ts`, and all pre-existing tests are **not** touched.

## 3. Interfaces & contracts

- `User` — `export type User { id: string; name: string; email: string; passwordHash: string; createdAt: Date; updatedAt: Date }`.
- `UserRepositoryInterface` (default export) — `findByEmail(email: string): Promise<User | undefined>`; `create(user: User): Promise<void>`.
- `RegisterUserQuery` — `{ name: string; email: string; password: string }` (no `id`/`createdAt`/`updatedAt`).
- `RegisterUserResponse` — `{ id: string; name: string; email: string; createdAt: Date; updatedAt: Date }` (unchanged; no password).
- `RegisterUserUseCase` — `constructor(userRepository: UserRepositoryInterface, passwordHasher: PasswordHasherInterface, dateTime: DateTimeInterface, idGenerator: IdGeneratorInterface)`; `invoke(query: RegisterUserQuery): Promise<RegisterUserResponse>`. Flow: `findByEmail` → if found throw `EmailAlreadyInUseError` → `hash(password)` → assemble `User` with `id = idGenerator.generate()`, `createdAt = updatedAt = dateTime.now()` → `create(user)` → return response.
- `DrizzleUserRepository implements UserRepositoryInterface` — `constructor(database: DatabaseClientInterface<DatabaseConnection>)`; each method opens `this.database.getConnection()` then runs the same query as legacy.
- `services.ts` — named export `registerUserUseCase`.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `EmailAlreadyInUseError` (thrown by `RegisterUserUseCase`) | The registration is rejected as a duplicate email; no account is created. (How the request edge maps this to a status code is unchanged and out of scope — the rebuilt use case is not yet reachable.) |

## 4. Data & persistence

No schema, table, column, or migration changes. The `users` table is **relocated code**
only — the ported `src/modules/user/infrastructure/database/schema.ts` describes the same
existing table (same names, types, and case-insensitive unique email index) as the legacy
schema, so `npx drizzle-kit generate` must produce **no new migration**.

**Table**: `users` (unchanged — described here for reference only)
| Column | Type | Nullable | Default | Constraints | Description |
|--|--|--|--|--|--|
| id | UUID | No | — | Primary key | Account identifier (app-provided) |
| name | text | No | — | — | Display name |
| email | text | No | — | Unique index on `lower(email)` | Email address (case-insensitive unique) |
| password_hash | text | No | — | — | Secured password (never plaintext) |
| created_at | timestamptz | No | — | — | Creation moment (UTC) |
| updated_at | timestamptz | No | — | — | Last-updated moment (UTC) |

- Migration: none — the table already exists and is unchanged.
- Rollback: n/a.
- Mapping: `passwordHash` ↔ `password_hash`, `createdAt` ↔ `created_at`, `updatedAt` ↔ `updated_at` (unchanged from legacy).

The legacy `users` schema stays registered in `src/config.ts`'s aggregated Drizzle schema,
so the sign-in capability's relational read (`db.query.users`) keeps working untouched
(V6). The new module's schema is intentionally **not** added to the aggregation in this
spec — the new repository queries its own table object directly (query-builder style, like
the prompt module), so aggregation is unnecessary and is deferred to the later cutover spec
(Assumption 3).

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Registration reachable from the rebuilt implementation with the same result as legacy | `RegisterUserUseCase` (unit test AC1) + `DrizzleUserRepository` (integration test AC3) + `services.ts` (AC4) | → E1 (duplicate) or success |
| V2 | Duplicate email (case-insensitive) rejected, no account created | `RegisterUserUseCase.invoke` (findByEmail guard); `DrizzleUserRepository.findByEmail` `lower()` match | → E1 |
| V3 | Identifier and timestamps produced inside the capability | `RegisterUserUseCase` via injected `IdGeneratorInterface`/`DateTimeInterface` | — |
| V4 | Password stored only secured; never returned | `RegisterUserUseCase` (`passwordHasher.hash`, response omits password) | — |
| V5 | Contracts separated from implementations | Layout: ports in `domain/interfaces/` + entity/error in `domain/`; adapters in `infrastructure/`; `eslint-plugin-boundaries` | — |
| V6 | Legacy, business areas, and stored records unchanged; sign-in still reads records | `git diff` shows no change under `src/logic/**`, `src/handlers/**`, `src/config.ts`; existing suite green | — |
| V7 | Quality gates pass, no data change | `npm run lint`, `npm run typecheck`, `npm test`; `npx drizzle-kit generate` yields no new SQL | — |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. The `User` entity is declared as `export type` (not `interface`) to match the prompt
   module's entity style — consequence if wrong: only the declaration keyword differs, no
   behavior impact.
2. Test files mirror the legacy directory shape under `tests/unit/modules/user/` and
   `tests/integration/modules/user/`, keeping the layer-based split (use-case unit,
   adapter integration) — consequence if wrong: only test-file placement differs.
3. The new module's `users` schema is **not** added to `src/config.ts`'s aggregation in
   this spec (the new repository uses the table object directly, query-builder style, like
   the prompt module did before its later aggregation); config aggregation and the request-
   edge cutover are deferred to a future spec — consequence if wrong: nothing breaks now,
   but the later cutover spec must add the aggregation before the handler is rewired.
4. The existing `UserModelFactory` and `tests/lib/database/users.ts` helpers (which import
   the legacy `User` type/`users` table) are reused unchanged by the new integration test;
   the ported and legacy row shapes are identical — consequence if wrong: the new test
   would need its own helpers, no production impact.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Duplicated user code drifts between the legacy and new copies before the cutover | med | low (interim only; deferred cleanup) | Keep the new copy behavior-identical; a follow-up spec rewires the edge and deletes the legacy copy. |
| R2 | Two `users` `pgTable` definitions (legacy + new) coexist and confuse the aggregated schema | low | low | Only the legacy schema is aggregated in `config.ts`; the new repository queries its own table object directly, so no aggregation collision occurs (mirrors the prompt module pre-aggregation). |
| R3 | `services.ts` composition constructs `DatabaseClient` from `@src/config` at import time | low | low | The client is lazy (no pool until `connect()`); loading the module opens no connection, exactly as the prompt/shared composition roots already do. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| New email | email not in use | Account created; id + timestamps self-assigned; hashed password persisted; response omits password | AC1 |
| Duplicate email, different case | existing `Ada@x.com`, register `ada@x.com` | `EmailAlreadyInUseError`; `create` never called | AC2 |
| Password never plaintext | any registration | stored `passwordHash` ≠ plaintext; response has no password field | AC1, AC3 |
| Find by email, case-insensitive | stored `Ada.Fixture@Example.com`, look up lowercase | returns the stored account | AC3 |
| Find by absent email | no matching row | returns `undefined` | AC3 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | §2 use case + repository + services; §5 V1 |
| V2 | §2 use case guard + repository `lower()`; §5 V2; §8 duplicate case |
| V3 | §2 use case injects id/clock providers; §3 constructor/flow; §5 V3 |
| V4 | §2 use case `hash` + response shape; §5 V4; §8 password case |
| V5 | §2 layer placement (domain vs infrastructure); §5 V5 boundaries |
| V6 | §1 "left unchanged"; §4 legacy schema stays aggregated; §5 V6 (`git diff`) |
| V7 | §4 no migration; §5 V7 (lint/typecheck/test + drizzle-kit generate) |
| E1 | §3 error table (`EmailAlreadyInUseError`); §2 use case guard |
| AC1 | `RegisterUserUseCase` + unit test; §8 new-email/password cases |
| AC2 | `RegisterUserUseCase` guard + unit test; §8 duplicate case |
| AC3 | `DrizzleUserRepository` + schema + integration test; §8 find cases |
| AC4 | `services.ts` composition root |
| AC5 | §2 layer placement; §5 V5 |
| AC6 | §1 coexistence; §5 V6 |
| AC7 | §5 V7 |
| Fields (§2) | §3 `User`/`RegisterUserResponse`; §4 table |
