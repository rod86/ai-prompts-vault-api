# Plan: Rebuild the sign-in (authentication) capability in the current module structure
Spec: specs/20260710111513-migrate-auth-to-modules/spec.md

## 1. Approach

Create a new `auth` bounded context at `src/modules/auth/` following the
`domain-driven-design` skill's structure and the exact conventions already established by
the rebuilt `src/modules/prompt/` and `src/modules/user/` contexts, by **porting** the
legacy `src/logic/auth/` files into the correct layer folders and adjusting them to current
guidelines:

- The `UserCredentials` entity and the `InvalidCredentialsError` domain error are ported
  essentially unchanged (the entity moves from `interface` to `export type` to match the
  prompt/user modules' entity style — Decision-logged assumption).
- The `UserCredentialsRepositoryInterface` contract is ported unchanged
  (`findByEmail(email): Promise<UserCredentials | undefined>`).
- The combined `AuthCryptoInterface` / `JwtAuthCryptoAdapter` is **split** (Decision 2):
  - `LoginUseCase` no longer depends on a combined crypto collaborator. It injects the
    shared `PasswordHasherInterface` directly and calls `compare(password, passwordHash)`
    for verification — mirroring how `src/modules/user/application/RegisterUserUseCase.ts`
    uses the shared hasher.
  - Token issuance becomes a narrowed, single-purpose port `TokenIssuerInterface`
    (`issueToken(userId, expiresAt): Promise<string>`) with a `JwtTokenIssuer` adapter that
    keeps the legacy JWT behavior exactly (`HS256`, payload `{ sub, exp }`, `exp` derived
    from the caller-supplied `expiresAt`). The legacy `verifyPassword` method disappears
    (its only job was to delegate to the shared hasher, which the use case now calls
    directly).
- `LoginUseCase` keeps computing the token expiry itself from the shared current-time
  provider and the configured `jwtExpirationSeconds`
  (`expiresAt = now + jwtExpirationSeconds * 1000`), preserving the exact token behavior of
  `009-login`.
- `DrizzleUserCredentialsRepository` is adjusted to the current persistence convention: it
  takes a `DatabaseClientInterface<DatabaseConnection>` and calls `getConnection()` per
  query, instead of receiving a raw connection (mirrors
  `src/modules/user/infrastructure/database/DrizzleUserRepository.ts`, per the
  `database-client-connect-at-boot` change). Its read is expressed query-builder style
  (`db.select({ id, email, passwordHash }).from(users).where(lower(email) = lower(?))`),
  replacing the legacy relational `db.query.users.findFirst` call.
- A full `users` Drizzle table is declared in the auth module
  (`src/modules/auth/infrastructure/database/schema.ts`), identical to the user module's
  copy (all columns + the `lower(email)` unique index), and the repository projects only the
  three credentials columns from it (Decision 3).
- A single `src/modules/auth/services.ts` composition root wires the repository, the token
  issuer, and the use case from the shared singletons (`databaseClient`, `passwordHasher`,
  `dateTimeService`) exported by `@src/modules/shared/services.js`, plus `config.jwtSecret`
  and `config.jwtExpirationSeconds`.

The legacy `src/logic/auth/**`, the `src/handlers/LoginHandler.ts` request edge, the
`/authenticate` route in `src/app.ts`, and `src/config.ts` are left **unchanged**
(Decision 1). The new context is not yet wired into the request edge — it is the verified
foundation for a later cutover spec. No new architecture-boundary configuration is required:
`.eslintrc.json` already matches `src/modules/*/{domain,application,infrastructure}`.

New tests are authored at the mirrored `tests/**/modules/auth/**` paths, ported from the
legacy tests and re-pointed to the new import paths, each written **before** the file it
exercises (test-first). The `LoginUseCase` unit test is adjusted to the split collaborators;
the credentials-repository integration test reuses the existing `userModelFactory` and
`tests/lib/database/users.ts` helpers as-is (they describe account rows, which are
unchanged).

Reused verbatim (shared, already present — no change):
- `src/modules/shared/domain/interfaces/DateTimeInterface.ts`,
  `PasswordHasherInterface.ts`, `DatabaseClientInterface.ts`
- `src/modules/shared/services.ts` singletons `databaseClient`, `passwordHasher`,
  `dateTimeService`, and the exported `DatabaseConnection` type.
- `src/config.ts` `jwtSecret` and `jwtExpirationSeconds` (read by `services.ts`; file
  itself unchanged).

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `UserCredentials` entity | new (port) | `src/modules/auth/domain/UserCredentials.ts` | Ported from `src/logic/auth/domain/UserCredentials.ts`; declared as `export type UserCredentials` (was `interface`) to match the prompt/user modules' entity style. Same fields (`id`, `email`, `passwordHash`). |
| `InvalidCredentialsError` | new (port) | `src/modules/auth/domain/errors/InvalidCredentialsError.ts` | Ported unchanged from legacy (extends `Error`, sets `name`, message `Invalid authentication credentials`). |
| `UserCredentialsRepositoryInterface` | new (port) | `src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.ts` | Ported unchanged: default-export `interface` with `findByEmail(email: string): Promise<UserCredentials \| undefined>`. |
| `TokenIssuerInterface` | new | `src/modules/auth/domain/interfaces/TokenIssuerInterface.ts` | New narrowed port replacing the token half of `AuthCryptoInterface`: default-export `interface` with `issueToken(userId: string, expiresAt: Date): Promise<string>`. |
| `LoginUseCase` (+ `LoginQuery`, `LoginResponse`) | new (adjusted) | `src/modules/auth/application/LoginUseCase.ts` | Constructor becomes `(userCredentialsRepository, passwordHasher, tokenIssuer, dateTime, tokenExpirationSeconds)`. Verifies via `passwordHasher.compare(query.password, credentials.passwordHash)` (was `authCrypto.verifyPassword`); issues via `tokenIssuer.issueToken(...)`. `LoginQuery`/`LoginResponse` unchanged. Expiry computed as before. |
| `JwtTokenIssuer` | new (adjusted) | `src/modules/auth/infrastructure/JwtTokenIssuer.ts` | Renamed/narrowed from `JwtAuthCryptoAdapter`: `implements TokenIssuerInterface`; constructor `(secret: string)` (drops the injected password hasher — no longer needed); `issueToken` body unchanged (`HS256`, `{ sub, exp }`); the `verifyPassword` method is dropped. |
| `users` Drizzle schema | new (port) | `src/modules/auth/infrastructure/database/schema.ts` | Full `users` table declared identically to `src/modules/user/infrastructure/database/schema.ts` (same table/column names, `lower(email)` unique index). Owned by this context for its read (Decision 3). |
| `DrizzleUserCredentialsRepository` | new (adjusted) | `src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts` | Constructor takes `DatabaseClientInterface<DatabaseConnection>`; `findByEmail` calls `this.database.getConnection()` then `db.select({ id, email, passwordHash }).from(users).where(sql\`lower(email) = lower(?)\`).limit(1)`, mapping the row to `UserCredentials` (or `undefined`). Imports `DatabaseConnection` from `@src/modules/shared/services.js`. |
| `services.ts` (composition root) | new | `src/modules/auth/services.ts` | `new DrizzleUserCredentialsRepository(databaseClient)`, `new JwtTokenIssuer(config.jwtSecret)`, `new LoginUseCase(userCredentialsRepository, passwordHasher, tokenIssuer, dateTimeService, config.jwtExpirationSeconds)`; exports `loginUseCase`. Shared collaborators imported from `@src/modules/shared/services.js`. |
| `LoginUseCase` unit test | new (port) | `tests/unit/modules/auth/application/LoginUseCase.test.ts` | Ported from the legacy unit test, adjusted: mocks `UserCredentialsRepositoryInterface`, `PasswordHasherInterface`, `TokenIssuerInterface`, `DateTimeInterface`; success asserts `passwordHasher.compare('p','hash')` and `tokenIssuer.issueToken('fixture-id', now + expiry)`; the two rejection cases assert `InvalidCredentialsError` and that `tokenIssuer.issueToken` is never called (unknown-email case also asserts `passwordHasher.compare` never called). |
| `JwtTokenIssuer` integration test | new (port) | `tests/integration/modules/auth/infrastructure/JwtTokenIssuer.test.ts` | Ported from `JwtAuthCryptoAdapter.test.ts`, keeping only the `issueToken` case (token carries `sub` and caller-supplied `exp`, verified with `jwt.verify`); constructor now `new JwtTokenIssuer('test-secret')`; the `verifyPassword` describe block is dropped. |
| `DrizzleUserCredentialsRepository` integration test | new (port) | `tests/integration/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.test.ts` | Ported from the legacy integration test, re-pointed; builds a `DatabaseClient` locally and passes the **client** to the repository (mirrors `DrizzleUserRepository.test.ts`). Reuses `userModelFactory` and `tests/lib/database/users.ts`. Same two cases (case-insensitive match → credentials projection; absent email → `undefined`). |

Legacy files under `src/logic/auth/**`, `src/handlers/**`, `src/app.ts`, `src/config.ts`,
and all pre-existing tests are **not** touched.

## 3. Interfaces & contracts

- `UserCredentials` — `export type UserCredentials { id: string; email: string; passwordHash: string }`.
- `UserCredentialsRepositoryInterface` (default export) — `findByEmail(email: string): Promise<UserCredentials | undefined>`.
- `TokenIssuerInterface` (default export) — `issueToken(userId: string, expiresAt: Date): Promise<string>`.
- `LoginQuery` — `{ email: string; password: string }` (unchanged).
- `LoginResponse` — `{ token: string }` (unchanged).
- `LoginUseCase` — `constructor(userCredentialsRepository: UserCredentialsRepositoryInterface, passwordHasher: PasswordHasherInterface, tokenIssuer: TokenIssuerInterface, dateTime: DateTimeInterface, tokenExpirationSeconds: number)`; `invoke(query: LoginQuery): Promise<LoginResponse>`. Flow: `findByEmail(email)` → if none throw `InvalidCredentialsError` → `passwordHasher.compare(password, passwordHash)` → if false throw `InvalidCredentialsError` → `expiresAt = new Date(dateTime.now().getTime() + tokenExpirationSeconds * 1000)` → `token = tokenIssuer.issueToken(credentials.id, expiresAt)` → return `{ token }`.
- `JwtTokenIssuer implements TokenIssuerInterface` — `constructor(secret: string)`; `issueToken(userId, expiresAt)` returns `jwt.sign({ sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) }, secret, { algorithm: 'HS256' })`.
- `DrizzleUserCredentialsRepository implements UserCredentialsRepositoryInterface` — `constructor(database: DatabaseClientInterface<DatabaseConnection>)`; `findByEmail` opens `this.database.getConnection()` then runs the projected `lower(email)` select, returning `{ id, email, passwordHash }` or `undefined`.
- `services.ts` — named export `loginUseCase`.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `InvalidCredentialsError` (thrown by `LoginUseCase` for unknown email or wrong password) | Sign-in is rejected as invalid credentials; no token is issued; the two causes are indistinguishable. (How the request edge maps this to a status code is unchanged and out of scope — the rebuilt use case is not yet reachable.) |

## 4. Data & persistence

No schema, table, column, or migration changes. The `users` table is **relocated/duplicated
code** only — the auth module's `src/modules/auth/infrastructure/database/schema.ts`
describes the same existing table (same names, types, and case-insensitive unique email
index) as the legacy and user-module schemas, so `npx drizzle-kit generate` must produce
**no new migration**.

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
- Mapping: `passwordHash` ↔ `password_hash` (the credentials projection reads `id`, `email`,
  `password_hash`).

The legacy `users` schema stays registered in `src/config.ts`'s aggregated Drizzle schema,
so the legacy auth read (`db.query.users`) keeps working untouched (V7). The auth module's
new schema copy is intentionally **not** added to the aggregation in this spec — the new
repository queries its own table object directly (query-builder style, like the prompt and
user modules), so aggregation is unnecessary and is deferred to the later cutover spec
(Assumption 3).

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Sign-in reachable from the rebuilt implementation with the same result as legacy | `LoginUseCase` (unit test AC1) + `DrizzleUserCredentialsRepository` (integration test AC5) + `services.ts` (AC6) | → E1 or success token |
| V2 | Unknown email (case-insensitive) rejected, no token, password not checked | `LoginUseCase.invoke` (findByEmail guard); `DrizzleUserCredentialsRepository.findByEmail` `lower()` match | → E1 |
| V3 | Wrong password rejected, no token | `LoginUseCase.invoke` (`passwordHasher.compare` guard) | → E1 |
| V4 | Success token carries the account id and expiry = now + configured seconds | `LoginUseCase` (expiry computation) + `JwtTokenIssuer.issueToken` | — |
| V5 | Password verified via shared provider; token issued via separate single-purpose collaborator | `LoginUseCase` deps (`PasswordHasherInterface` + `TokenIssuerInterface`); `JwtTokenIssuer` (no verify method) | — |
| V6 | Contracts separated from implementations | Layout: ports in `domain/interfaces/` + entity/error in `domain/`; adapters in `infrastructure/`; `eslint-plugin-boundaries` | — |
| V7 | Legacy, business areas, and stored records unchanged | `git diff` shows no change under `src/logic/**`, `src/handlers/**`, `src/app.ts`, `src/config.ts`; existing suite green | — |
| V8 | Quality gates pass, no data change | `npm run lint`, `npm run typecheck`, `npm test`; `npx drizzle-kit generate` yields no new SQL | — |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. The `UserCredentials` entity is declared as `export type` (not `interface`) to match the
   prompt/user modules' entity style — consequence if wrong: only the declaration keyword
   differs, no behavior impact.
2. Test files mirror the legacy directory shape under `tests/unit/modules/auth/` and
   `tests/integration/modules/auth/`, keeping the layer-based split (use-case unit; token
   issuer and adapter integration) — consequence if wrong: only test-file placement differs.
3. The auth module's `users` schema copy is **not** added to `src/config.ts`'s aggregation in
   this spec (the new repository uses the table object directly, query-builder style, like
   the prompt and user modules); config aggregation and the request-edge cutover are deferred
   to a future spec — consequence if wrong: nothing breaks now, but the later cutover spec
   must reconcile the aggregation before the handler is rewired.
4. The existing `userModelFactory` and `tests/lib/database/users.ts` helpers (which describe
   account rows) are reused unchanged by the new credentials integration test; the row shape
   is identical — consequence if wrong: the new test would need its own helpers, no
   production impact.
5. The new token-issuing adapter is named `JwtTokenIssuer` and lives at
   `src/modules/auth/infrastructure/JwtTokenIssuer.ts` (top of `infrastructure/`, mirroring
   the legacy `JwtAuthCryptoAdapter.ts` placement) — consequence if wrong: only the file
   name/path differs.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Duplicated auth code drifts between the legacy and new copies before the cutover | med | low (interim only; deferred cleanup) | Keep the new copy behavior-identical; a follow-up spec rewires the edge and deletes the legacy copy. |
| R2 | A third `users` `pgTable` definition (legacy + user module + auth module) coexists and confuses the aggregated schema | low | low | Only the legacy schema is aggregated in `config.ts`; the new repository queries its own table object directly, so no aggregation collision occurs (mirrors the user module pre-aggregation). |
| R3 | Splitting the crypto collaborator changes the token or verification behavior | low | low (med if it slipped) | `JwtTokenIssuer.issueToken` body is byte-for-byte the legacy `issueToken`; verification still calls the same shared `passwordHasher.compare`; ported tests assert identical token contents and accept/reject outcomes. |
| R4 | `services.ts` composition constructs `DatabaseClient`/reads `config` at import time | low | low | The client is lazy (no pool until `connect()`); loading the module opens no connection, exactly as the prompt/user composition roots already do. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Valid credentials | email matches stored account, correct password | token issued with `sub = account id`, `exp = now + configured seconds` | AC1, AC4 |
| Unknown email, different case | no account for `lower(email)` | `InvalidCredentialsError`; `passwordHasher.compare` never called; no token | AC2 |
| Wrong password | matching account, `compare` returns false | `InvalidCredentialsError`; `issueToken` never called | AC3 |
| Find by email, case-insensitive | stored `Ada.Fixture@Example.com`, look up lowercase | returns the credentials projection `{ id, email, passwordHash }` | AC5 |
| Find by absent email | no matching row | returns `undefined` | AC5 |
| Token contents | issue for id + explicit expiry | decoded token has matching `sub` and `exp` | AC4 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | §2 use case + repository + services; §5 V1 |
| V2 | §2 use case findByEmail guard + repository `lower()`; §5 V2; §8 unknown-email case |
| V3 | §2 use case `compare` guard; §5 V3; §8 wrong-password case |
| V4 | §2 use case expiry + `JwtTokenIssuer`; §3 flow; §5 V4; §8 token-contents case |
| V5 | §2 split deps (`PasswordHasherInterface` + `TokenIssuerInterface`), `JwtTokenIssuer` has no verify; §5 V5 |
| V6 | §2 layer placement (domain vs infrastructure); §5 V6 boundaries |
| V7 | §1 "left unchanged"; §4 legacy schema stays aggregated; §5 V7 (`git diff`) |
| V8 | §4 no migration; §5 V8 (lint/typecheck/test + drizzle-kit generate) |
| E1 | §3 error table (`InvalidCredentialsError`); §2 use case guards |
| AC1 | `LoginUseCase` + unit test; §8 valid-credentials case |
| AC2 | `LoginUseCase` findByEmail guard + unit test; §8 unknown-email case |
| AC3 | `LoginUseCase` compare guard + unit test; §8 wrong-password case |
| AC4 | `JwtTokenIssuer` + integration test; §8 token-contents case |
| AC5 | `DrizzleUserCredentialsRepository` + schema + integration test; §8 find cases |
| AC6 | `services.ts` composition root |
| AC7 | §2 layer placement; §5 V6 |
| AC8 | §1 coexistence; §5 V7 |
| AC9 | §5 V8 |
| Fields (§2) | §3 `UserCredentials`/`LoginQuery`/`LoginResponse`; §4 table |
