# Tasks: Login

Plan: specs/009-login/plan.md

- [ ] T1. Install jsonwebtoken dependency
    - Red: none — this is a dependency-change task, not a code test (per
      `spec-planner`'s "dependency-change tasks come before the code that
      needs them"). Confirm the gap first: `jsonwebtoken`/`@types/jsonwebtoken`
      are absent from `package.json`.
    - Green: `npm install jsonwebtoken@^9.0.2` and
      `npm install -D @types/jsonwebtoken@^9.0.7` per plan.md §8.
    - Covers: enables AC1 (token issuance is a precondition for every later
      task in this file).

- [ ] T2. Relocate the password hasher to `shared` and add `compare()`
    - Red: move `tests/integration/logic/user/infrastructure/BcryptPasswordHasher.test.ts`
      to `tests/integration/logic/shared/infrastructure/security/BcryptPasswordHasher.test.ts`,
      updating its import to `@logic/shared/infrastructure/security/BcryptPasswordHasher.js`;
      add a new `describe('compare', ...)` in that same file asserting
      `await hasher.compare('Sup3r$ecret!', hash)` resolves `true` for a hash
      produced by `hash('Sup3r$ecret!')`, and `await hasher.compare('wrong-password', hash)`
      resolves `false`. Fails: nothing exists yet at
      `@logic/shared/infrastructure/security/BcryptPasswordHasher.js`.
    - Green: create `src/logic/shared/domain/interfaces/PasswordHasherInterface.ts`
      (`hash` + new `compare`) and `src/logic/shared/infrastructure/security/BcryptPasswordHasher.ts`
      (moved body from `src/logic/user/infrastructure/BcryptPasswordHasher.ts`,
      plus `compare()` via `bcrypt.compare`); delete
      `src/logic/user/domain/interfaces/PasswordHasherInterface.ts` and
      `src/logic/user/infrastructure/BcryptPasswordHasher.ts`; update
      `RegisterUserUseCase.ts`'s `PasswordHasherInterface` import path (and
      `tests/unit/logic/user/application/RegisterUserUseCase.test.ts`'s mock
      import path) to `@logic/shared/domain/interfaces/PasswordHasherInterface.js`;
      export `passwordHasher` from `src/logic/shared/services.ts`; update
      `src/logic/user/services.ts` to import `passwordHasher` from
      `@logic/shared/services.js` instead of constructing its own
      `BcryptPasswordHasher`, per plan.md §7. Run the full test suite to
      confirm `RegisterUserUseCase`'s existing tests still pass unchanged.
    - Covers: enables AC1, AC2, AC6, AC7 (the shared verification mechanism
      every later task in this file depends on).

- [ ] T3. DateTimeService exposes the current time through an injectable port
    - Red: `tests/unit/logic/shared/utils/DateTimeService.test.ts` — construct
      `const dateService = new DateTimeService()`; capture `const before = Date.now()`; call
      `const result = dateService.now()`; capture `const after = Date.now()`;
      assert `result.getTime()` is `>= before` and `<= after`. Fails:
      `DateTimeInterface`/`DateTimeService` do not exist yet.
    - Green: create `src/logic/shared/utils/DateTimeInterface.ts` (`now(): Date`)
      and `src/logic/shared/utils/DateTimeService.ts` implementing it via
      `new Date()`; export `dateTimeService` from `src/logic/shared/services.ts`,
      per plan.md §3/§7.
    - Covers: enables AC1, AC2 (the token-expiration mechanism a later task
      depends on).

- [ ] T4. DrizzleUserCredentialsRepository resolves an account's credentials for a matching email, case-insensitively
    - Red: `tests/integration/logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.test.ts` —
      per `testing` skill integration conventions, open the connection once
      in `beforeAll`; build a `User` fixture via
      `userModelFactory.create({ email: 'Ada.Fixture@Example.com' })`; insert
      it via `insertUsers` (from `tests/lib/database/users.ts` — the real
      `users` table); call
      `new DrizzleUserCredentialsRepository(databaseClient.connect()).findByEmail('ada.fixture@example.com')`
      (different case, using the shared, fully-typed `databaseClient` from
      `@logic/shared/services.js` — not a new schema); assert the result
      equals
      `{ id: fixture.id, email: fixture.email, passwordHash: fixture.passwordHash }`;
      clean up the inserted row in `afterEach` via `deleteUsersByIds`. Fails:
      `UserCredentialsRepositoryInterface`/`UserCredentials`/
      `DrizzleUserCredentialsRepository` do not exist yet.
    - Green: create `src/logic/auth/domain/UserCredentials.ts`,
      `src/logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.ts`,
      and `src/logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts`
      per plan.md §2/§3/§7 — no new schema file; the repository's constructor
      takes `DatabaseConnection<typeof config.database.schema>` and reads via
      `db.query.users.findFirst({ where: (users, { sql }) => sql`lower(${users.email}) = lower(${email})` })`,
      relying on `user`'s existing `users` table (already part of the
      aggregated schema `databaseClient` is built from).
    - Covers: AC1 "Given an email that belongs to an existing account and the
      matching password for that account are supplied, When the visitor logs
      in, Then a token proving their identity is issued, and no other account
      information is returned."; AC2 "Given an email that belongs to an
      existing account with uppercase letters compared to how the account was
      registered (e.g. the account's email is "ada@example.com" and the
      visitor supplies "Ada@Example.com") along with the matching password,
      When the visitor logs in, Then a token is issued exactly as in AC1 —
      the email match does not depend on letter case."

- [ ] T5. DrizzleUserCredentialsRepository resolves undefined for an email with no matching account
    - Red: same file as T4 — new `it`; call
      `repository.findByEmail(faker.internet.email())` with no matching
      inserted row; assert the result is `undefined`.
    - Green: none beyond T4 — `findByEmail` already returns `undefined` when
      the query yields no row. Run the test to confirm.
    - Covers: AC6 "Given the supplied email does not belong to any existing
      account, When the visitor attempts to log in, Then the visitor is told
      the email or password is invalid (E1), and no token is issued." (the
      repository-level signal this response depends on).

- [ ] T6. JwtAuthCryptoAdapter issues a token carrying the user id and an explicit, caller-supplied expiration
    - Red: `tests/integration/logic/auth/infrastructure/JwtAuthCryptoAdapter.test.ts` —
      construct `new JwtAuthCryptoAdapter('test-secret', mock<PasswordHasherInterface>())`;
      call `issueToken('fixture-user-id', new Date('2026-01-01T01:00:00.000Z'))`;
      assert the result is a defined string;
      decode it via `jwt.verify(token, 'test-secret')`; assert the decoded
      payload's `sub` equals `'fixture-user-id'` and `exp` equals
      `Math.floor(new Date('2026-01-01T01:00:00.000Z').getTime() / 1000)`.
      Fails: `AuthCryptoInterface`/`JwtAuthCryptoAdapter` do not exist yet.
    - Green: create `src/logic/auth/domain/interfaces/AuthCryptoInterface.ts`
      and `src/logic/auth/infrastructure/JwtAuthCryptoAdapter.ts` per
      plan.md §3/§7, signing `{ sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) }`
      with `HS256` and no `expiresIn` option.
    - Covers: AC1 (see T4 text above) — the token-issuance mechanism the use
      case depends on.

- [ ] T7. JwtAuthCryptoAdapter.verifyPassword resolves true for a matching password
    - Red: same file as T6 — new `it`; construct with a
      `mock<PasswordHasherInterface>()` whose `compare` is set via
      `passwordHasher.compare.mockResolvedValue(true)`; call
      `adapter.verifyPassword('plaintext', 'stored-hash')`; assert the result
      is `true`; assert `passwordHasher.compare` was called once with
      `('plaintext', 'stored-hash')`.
    - Green: implement `verifyPassword` on `JwtAuthCryptoAdapter`, delegating
      to `this.passwordHasher.compare(password, passwordHash)`, per plan.md
      §7.
    - Covers: AC1 (see T4 text above) — the password-verification mechanism
      the use case depends on.

- [ ] T8. JwtAuthCryptoAdapter.verifyPassword resolves false for a non-matching password
    - Red: same file as T6 — new `it`;
      `passwordHasher.compare.mockResolvedValue(false)`; call
      `adapter.verifyPassword('wrong-password', 'stored-hash')`; assert the
      result is `false`.
    - Green: none beyond T7 — `verifyPassword` already returns whatever
      `compare()` resolves. Run the test to confirm.
    - Covers: AC7 "Given the supplied email belongs to an existing account
      but the supplied password does not match that account's stored
      credential, When the visitor attempts to log in, Then the visitor is
      told the email or password is invalid (E1) — the exact same message as
      AC6 — and no token is issued." (the mechanism this response depends
      on).

- [ ] T9. LoginUseCase issues a token when the email and password both match
    - Red: `tests/unit/logic/auth/application/LoginUseCase.test.ts` —
      construct `LoginUseCase` with `mock<UserCredentialsRepositoryInterface>()`,
      `mock<AuthCryptoInterface>()`, `mock<DateTimeInterface>()`, and a fixed
      `tokenExpirationSeconds` (e.g. `3600`); set
      `userCredentialsRepository.findByEmail.mockResolvedValue({ id: 'fixture-id', email: 'a@b.com', passwordHash: 'hash' })`,
      `authCrypto.verifyPassword.mockResolvedValue(true)`,
      `dateService.now.mockReturnValue(new Date('2026-01-01T00:00:00.000Z'))`, and
      `authCrypto.issueToken.mockResolvedValue('signed-token')`; call
      `useCase.invoke({ email: 'a@b.com', password: 'p' })`; assert the
      result equals `{ token: 'signed-token' }`; assert
      `authCrypto.verifyPassword` was called with `('p', 'hash')`; assert
      `authCrypto.issueToken` was called once with
      `('fixture-id', new Date('2026-01-01T01:00:00.000Z'))` (one hour after
      the mocked `now`). Fails: `UserCredentials`, `UserCredentialsRepositoryInterface`,
      `AuthCryptoInterface`, `DateTimeInterface`, `LoginUseCase` do not exist yet
      (or exist only partially from earlier tasks) — `LoginUseCase` itself is
      new.
    - Green: create `src/logic/auth/application/LoginUseCase.ts` per plan.md
      §4, wiring the four constructor dependencies and the `invoke` flow
      described there (no `InvalidCredentialsError` branch exercised by this
      test yet).
    - Covers: AC1 (see T4 text above).

- [ ] T10. LoginUseCase throws InvalidCredentialsError when no account matches the email
    - Red: same file as T9 — new `it`;
      `userCredentialsRepository.findByEmail.mockResolvedValue(undefined)`;
      call `useCase.invoke({ email: 'unknown@example.com', password: 'p' })`;
      assert
      `await expect(useCase.invoke(...)).rejects.toThrow(InvalidCredentialsError)`
      and `.rejects.toThrow('Invalid authentication credentials')` (per `testing`
      skill — asserting both error type and message); assert
      `authCrypto.verifyPassword` and `authCrypto.issueToken` were never
      called. Fails: `InvalidCredentialsError` does not exist yet.
    - Green: create `src/logic/auth/domain/errors/InvalidCredentialsError.ts`
      per plan.md §2; `LoginUseCase.invoke()` throws
      `new InvalidCredentialsError()` immediately when `findByEmail` resolves
      `undefined`, before calling `verifyPassword`.
    - Covers: AC6 (see T5 text above).

- [ ] T11. LoginUseCase throws InvalidCredentialsError when the password does not match
    - Red: same file as T9 — new `it`;
      `userCredentialsRepository.findByEmail.mockResolvedValue({ id: 'fixture-id', email: 'a@b.com', passwordHash: 'hash' })`
      and `authCrypto.verifyPassword.mockResolvedValue(false)`; call
      `useCase.invoke({ email: 'a@b.com', password: 'wrong-password' })`;
      assert it rejects with `InvalidCredentialsError`/`'Invalid authentication credentials'`;
      assert `authCrypto.issueToken` was never called.
    - Green: none beyond T9/T10 — `LoginUseCase.invoke()` already throws
      `InvalidCredentialsError` when `verifyPassword` resolves `false`. Run
      the test to confirm.
    - Covers: AC7 (see T8 text above).

- [ ] T12. `POST /authenticate` issues a token for valid credentials, matching email case-insensitively
    - Red: `tests/integration/handlers/LoginHandler.test.ts` — new top-level
      `describe('POST /authenticate', ...)`; hash a known password via
      `new BcryptPasswordHasher().hash(...)` (from
      `@logic/shared/infrastructure/security/BcryptPasswordHasher.js`); insert a fixture
      user (via `insertUsers`) with a mixed-case email (e.g.
      `'Login.Fixture@Example.com'`) and that hash; using `supertest` against
      the real Express `app`, `POST /authenticate` with
      `{ email: 'login.fixture@example.com', password: <the known plaintext password> }`
      (different case); assert status `200`; assert the JSON body is exactly
      `{ token: expect.any(String) }`; decode the returned token via
      `jwt.verify(token, config.jwtSecret)` and assert its `sub` equals the
      fixture's `id` and its `exp` is `config.jwtExpirationSeconds` seconds
      after its `iat`; clean up the inserted row afterward. Fails: no
      `POST /authenticate` route, handler, use-case wiring, or schema exists yet.
    - Green: create `src/schemas/LoginSchema.ts` per plan.md §6; add
      `jwtSecret: process.env.JWT_SECRET ?? ''` and
      `jwtExpirationSeconds: Number(process.env.JWT_EXPIRATION_SECONDS ?? 3600)`
      to `src/config.ts`; create `src/handlers/LoginHandler.ts` that reads
      `req.parsedRequest?.body`, calls `loginUseCase.invoke(...)` inside a
      `try/catch`, and responds `200` with `{ token }` on success; create
      `src/logic/auth/services.ts` wiring `DrizzleUserCredentialsRepository`,
      `JwtAuthCryptoAdapter`, `dateTimeService`, and `config.jwtExpirationSeconds`
      into `loginUseCase` per plan.md §7; register
      `app.post('/authenticate', validateRequestMiddleware(LoginSchema), loginHandler)`
      in `src/app.ts`.
    - Covers: AC1, AC2 (see T4 text above).

- [ ] T13. `POST /authenticate` returns an invalid-credentials error for an unknown email
    - Red: same file as T12 — new `it`; `POST /authenticate` with
      `{ email: faker.internet.email(), password: 'any-password' }` (no
      matching account); assert status `401` and the JSON body equals
      `{ error: 'Invalid authentication credentials' }`.
    - Green: none beyond T12 — `LoginHandler.ts`'s `catch` block already
      catches `InvalidCredentialsError` and responds `401` with its message
      (plan.md §5).
    - Covers: AC6 (see T5 text above).

- [ ] T14. `POST /authenticate` returns an invalid-credentials error for a wrong password on an existing account
    - Red: same file as T12 — new `it`; insert a fixture user (known hashed
      password, via `insertUsers`); `POST /authenticate` with
      `{ email: fixture.email, password: 'a-completely-wrong-password' }`;
      assert status `401` and the JSON body equals
      `{ error: 'Invalid authentication credentials' }`; clean up the inserted row
      afterward.
    - Green: none beyond T12.
    - Covers: AC7 (see T8 text above).

- [ ] T15. `POST /authenticate` Request Validation — returns missing-field errors for an empty body
    - Red: same file as T12 — nested `describe('Request Validation', ...)`
      per `testing` skill's Request Validation convention; `POST /authenticate`
      with `{}`; assert status `400` and the body's `errors` array contains
      exactly `{ field: 'body.email', error: 'Missing required value' }` and
      `{ field: 'body.password', error: 'Missing required value' }` (exact
      object literals, per `testing` skill).
    - Green: none beyond T12 — `LoginSchema.body`'s `z.object` already
      reports both missing required fields together via the existing
      `validateRequestMiddleware` mechanism.
    - Covers: AC3 "Given the email is missing, When the visitor attempts to
      log in, Then the visitor is told the email is missing (V1), and no
      token is issued."; AC4 "Given the password is missing, When the
      visitor attempts to log in, Then the visitor is told the password is
      missing (V2), and no token is issued."; AC5 "Given both the email and
      the password are missing, When the visitor attempts to log in, Then
      the visitor is told about both problems together (V1/V2), not only the
      first one found, and no token is issued."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | --- | --- |
| AC1 | Given an email that belongs to an existing account and the matching password for that account are supplied, When the visitor logs in, Then a token proving their identity is issued, and no other account information is returned. | T2, T3, T4, T6, T7, T9, T12 |
| AC2 | Given an email that belongs to an existing account with uppercase letters compared to how the account was registered (e.g. the account's email is "ada@example.com" and the visitor supplies "Ada@Example.com") along with the matching password, When the visitor logs in, Then a token is issued exactly as in AC1 — the email match does not depend on letter case. | T4, T12 |
| AC3 | Given the email is missing, When the visitor attempts to log in, Then the visitor is told the email is missing (V1), and no token is issued. | T15 |
| AC4 | Given the password is missing, When the visitor attempts to log in, Then the visitor is told the password is missing (V2), and no token is issued. | T15 |
| AC5 | Given both the email and the password are missing, When the visitor attempts to log in, Then the visitor is told about both problems together (V1/V2), not only the first one found, and no token is issued. | T15 |
| AC6 | Given the supplied email does not belong to any existing account, When the visitor attempts to log in, Then the visitor is told the email or password is invalid (E1), and no token is issued. | T5, T10, T13 |
| AC7 | Given the supplied email belongs to an existing account but the supplied password does not match that account's stored credential, When the visitor attempts to log in, Then the visitor is told the email or password is invalid (E1) — the exact same message as AC6 — and no token is issued. | T8, T11, T14 |
