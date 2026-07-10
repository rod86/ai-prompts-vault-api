# Tasks: Rebuild the sign-in (authentication) capability in the current module structure
Plan: specs/20260710111513-migrate-auth-to-modules/plan.md

- [x] T1. Add the `UserCredentials` entity
  - Type: domain
  - Depends on: none
  - Red: none — pure type declaration, no logic; see `testing-practices` "no logic, no test" rule.
  - Green: create `src/modules/auth/domain/UserCredentials.ts` — `export type UserCredentials { id: string; email: string; passwordHash: string }`, ported from `src/logic/auth/domain/UserCredentials.ts` (declared as `type` per `plan.md` §7 Assumption 1).
  - Covers: underlies AC1, AC5 (credentials shape); V1

- [x] T2. Add the `InvalidCredentialsError` domain error
  - Type: domain
  - Depends on: none
  - Red: none — no dedicated test; covered indirectly by the use-case rejection branches in T5.
  - Green: create `src/modules/auth/domain/errors/InvalidCredentialsError.ts`, ported unchanged from `src/logic/auth/domain/errors/InvalidCredentialsError.ts` (extends `Error`, sets `name`, message `Invalid authentication credentials`).
  - Covers: E1

- [x] T3. Add the `UserCredentialsRepositoryInterface` port
  - Type: domain
  - Depends on: T1
  - Red: none — contract only, no dedicated test.
  - Green: create `src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.ts`, default-exported, ported unchanged from legacy: `findByEmail(email: string): Promise<UserCredentials | undefined>`.
  - Covers: V6

- [x] T4. Add the `TokenIssuerInterface` port
  - Type: domain
  - Depends on: none
  - Red: none — contract only, no dedicated test.
  - Green: create `src/modules/auth/domain/interfaces/TokenIssuerInterface.ts`, default-exported: `issueToken(userId: string, expiresAt: Date): Promise<string>` (the narrowed token half of the legacy `AuthCryptoInterface`, per `plan.md` §2, Decision 2).
  - Covers: V5, V6

- [x] T5. `LoginUseCase` with shared password verification + separate token issuer
  - Type: application
  - Depends on: T1, T2, T3, T4
  - Red: `tests/unit/modules/auth/application/LoginUseCase.test.ts` (ported from `tests/unit/logic/auth/application/LoginUseCase.test.ts`, adjusted per `plan.md` §2) — mocks `UserCredentialsRepositoryInterface`, `PasswordHasherInterface`, `TokenIssuerInterface`, `DateTimeInterface`; constructs `new LoginUseCase(userCredentialsRepository, passwordHasher, tokenIssuer, dateService, 3600)`. Success case: `findByEmail` returns `{ id: 'fixture-id', email, passwordHash: 'hash' }`, `passwordHasher.compare` → true, `dateService.now` → `2026-01-01T00:00:00Z`, `tokenIssuer.issueToken` → `'signed-token'`; asserts result `{ token: 'signed-token' }`, `passwordHasher.compare` called with `('p','hash')`, and `tokenIssuer.issueToken` called once with `('fixture-id', new Date('2026-01-01T01:00:00.000Z'))`. Unknown-email case: `findByEmail` → undefined; asserts `InvalidCredentialsError` + message `Invalid authentication credentials`, and `passwordHasher.compare`/`tokenIssuer.issueToken` never called. Wrong-password case: `compare` → false; asserts `InvalidCredentialsError` and `tokenIssuer.issueToken` never called. Fails: class/constructor shape doesn't exist yet.
  - Green: create `src/modules/auth/application/LoginUseCase.ts` per `plan.md` §3 — constructor `(userCredentialsRepository, passwordHasher, tokenIssuer, dateTime, tokenExpirationSeconds)`; `LoginQuery = { email, password }`, `LoginResponse = { token }`; flow: findByEmail → guard → `passwordHasher.compare` → guard → `expiresAt = now + tokenExpirationSeconds * 1000` → `tokenIssuer.issueToken(id, expiresAt)` → return `{ token }`.
  - Covers: AC1 "Given the rebuilt implementation, When sign-in is attempted with an email that matches a stored account and the account's correct password, Then a token is issued carrying the account's identifier and an expiry the fixed configured number of seconds ahead of the current moment — exactly as `009-login` describes"; AC2 "Given the rebuilt implementation, When sign-in is attempted with an email that matches no stored account (compared case-insensitively), Then the invalid-credentials error (E1) is raised, the password is never checked, and no token is issued — exactly as `009-login` describes"; AC3 "Given the rebuilt implementation, When sign-in is attempted with an email that matches a stored account but an incorrect password, Then the invalid-credentials error (E1) is raised and no token is issued — exactly as `009-login` describes"; V1, V2, V3, V4, V5, E1

- [x] T6. `JwtTokenIssuer` adapter
  - Type: infrastructure
  - Depends on: T4
  - Red: `tests/integration/modules/auth/infrastructure/JwtTokenIssuer.test.ts` (ported from `tests/integration/logic/auth/infrastructure/JwtAuthCryptoAdapter.test.ts`, keeping only the `issueToken` case per `plan.md` §2) — `new JwtTokenIssuer('test-secret')`; issuing for `'fixture-user-id'` and an explicit `expiresAt` yields a token that `jwt.verify(..., { ignoreExpiration: true })` decodes to `{ sub: 'fixture-user-id', exp: Math.floor(expiresAt/1000) }`. The legacy `verifyPassword` describe block is dropped. Fails: class doesn't exist.
  - Green: create `src/modules/auth/infrastructure/JwtTokenIssuer.ts` per `plan.md` §3 — `implements TokenIssuerInterface`; `constructor(secret: string)`; `issueToken(userId, expiresAt)` returns `jwt.sign({ sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) }, secret, { algorithm: 'HS256' })`. No `verifyPassword`.
  - Covers: AC4 "Given the rebuilt token issuer, When a token is issued for an account identifier and an explicit expiry, Then the token carries that identifier and that expiry, exactly as the existing implementation does"; V4, V5

- [ ] T7. Add the auth module `users` Drizzle schema
  - Type: infrastructure
  - Depends on: none
  - Red: none — pure table declaration, no logic.
  - Green: create `src/modules/auth/infrastructure/database/schema.ts`, a full `users` table declared identically to `src/modules/user/infrastructure/database/schema.ts` (same table/column names, types, and `lower(email)` unique index) per `plan.md` §4, Decision 3.
  - Covers: V8 (no new migration); underlies AC5

- [ ] T8. `DrizzleUserCredentialsRepository` on the current persistence convention
  - Type: infrastructure
  - Depends on: T1, T3, T7
  - Red: `tests/integration/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.test.ts` (ported from `tests/integration/logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.test.ts`, import paths updated; real DB via `tests/lib/config.ts`; builds a `DatabaseClient` locally and passes the **client** to the repository, mirroring `tests/integration/modules/user/infrastructure/database/DrizzleUserRepository.test.ts`) — `findByEmail` resolves the credentials projection `{ id, email, passwordHash }` for a matching email case-insensitively and `undefined` when none matches. Reuses `userModelFactory` and `tests/lib/database/users.ts`. Fails: class doesn't exist.
  - Green: create `src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts` per `plan.md` §3 — constructor takes `DatabaseClientInterface<DatabaseConnection>`; `findByEmail` calls `this.database.getConnection()` then `db.select({ id, email, passwordHash }).from(users).where(sql\`lower(email) = lower(?)\`).limit(1)`, mapping to `UserCredentials` or `undefined`; `DatabaseConnection` imported from `@src/modules/shared/services.js`.
  - Covers: AC5 "Given the rebuilt persistence adapter, When an account is looked up by email, Then the same account's credentials projection (identifier, email, stored secured password) is found case-insensitively and nothing is found for an absent email, exactly as the existing adapter does"; V1, V2

- [ ] T9. Auth module composition root
  - Type: infrastructure
  - Depends on: T5, T6, T8
  - Red: none — `services.ts` is pure composition; see `testing-practices`.
  - Green: create `src/modules/auth/services.ts` — `new DrizzleUserCredentialsRepository(databaseClient)`, `new JwtTokenIssuer(config.jwtSecret)`, `new LoginUseCase(userCredentialsRepository, passwordHasher, tokenIssuer, dateTimeService, config.jwtExpirationSeconds)` (`databaseClient`, `passwordHasher`, `dateTimeService` imported from `@src/modules/shared/services.js`; `config` from `@src/config.js`); export `loginUseCase`.
  - Covers: AC6 "Given the rebuilt module, When its composition entry point is loaded, Then it exposes a ready-to-use sign-in capability wired to the credentials adapter, the shared secured-password provider, the token issuer, the shared current-time provider, and the configured token expiry"; V1, V5

- [ ] T10. Full-suite verification and legacy-intact check
  - Type: infrastructure
  - Depends on: T1, T2, T3, T4, T5, T6, T7, T8, T9
  - Red: none — verification step, no new behavior.
  - Green: run `npm run lint` (incl. boundary rules — the new folder is already covered by the existing `src/modules/*` element, so no `.eslintrc.json` change), `npm run typecheck`, and `npm test` (all green); run `npx drizzle-kit generate` and confirm no new SQL migration is produced; confirm `src/logic/**`, `src/handlers/**`, `src/app.ts`, `src/config.ts`, and every pre-existing test file are unchanged (`git diff`), and that the legacy auth suite still passes.
  - Covers: AC7 "Given the rebuilt module, When its structure is inspected, Then the capability's and its collaborators' contracts are placed separately from their concrete implementations, per the current architecture guidelines"; AC8 "Given the rebuild is complete, When the existing implementation, the other business areas, and the stored account records are inspected, Then they are unchanged, every other capability that reads or writes those records still does so, and their existing tests still pass"; AC9 "Given the rebuild is complete, When the project's lint, type-check, and full test suite are run, Then all pass and no change to stored data is required"; V6, V7, V8

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | *Sign in with valid credentials.* Given the rebuilt implementation, When sign-in is attempted with an email that matches a stored account and the account's correct password, Then a token is issued carrying the account's identifier and an expiry the fixed configured number of seconds ahead of the current moment — exactly as `009-login` describes. | T5, T9 |
| AC2 | *Unknown email rejected.* Given the rebuilt implementation, When sign-in is attempted with an email that matches no stored account (compared case-insensitively), Then the invalid-credentials error (E1) is raised, the password is never checked, and no token is issued — exactly as `009-login` describes. | T5 |
| AC3 | *Wrong password rejected.* Given the rebuilt implementation, When sign-in is attempted with an email that matches a stored account but an incorrect password, Then the invalid-credentials error (E1) is raised and no token is issued — exactly as `009-login` describes. | T5 |
| AC4 | *Token issued by a single-purpose issuer.* Given the rebuilt token issuer, When a token is issued for an account identifier and an explicit expiry, Then the token carries that identifier and that expiry, exactly as the existing implementation does. | T6 |
| AC5 | *Credentials read from the account records.* Given the rebuilt persistence adapter, When an account is looked up by email, Then the same account's credentials projection (identifier, email, stored secured password) is found case-insensitively and nothing is found for an absent email, exactly as the existing adapter does. | T7, T8 |
| AC6 | *Single composition entry point.* Given the rebuilt module, When its composition entry point is loaded, Then it exposes a ready-to-use sign-in capability wired to the credentials adapter, the shared secured-password provider, the token issuer, the shared current-time provider, and the configured token expiry. | T9 |
| AC7 | *Contracts separated.* Given the rebuilt module, When its structure is inspected, Then the capability's and its collaborators' contracts are placed separately from their concrete implementations, per the current architecture guidelines. | T1, T2, T3, T4, T10 |
| AC8 | *Legacy and shared records intact.* Given the rebuild is complete, When the existing implementation, the other business areas, and the stored account records are inspected, Then they are unchanged, every other capability that reads or writes those records still does so, and their existing tests still pass. | T10 |
| AC9 | *Quality gates pass, no data change.* Given the rebuild is complete, When the project's lint, type-check, and full test suite are run, Then all pass and no change to stored data is required. | T10 |
