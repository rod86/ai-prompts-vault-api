# Tasks: User registration

Plan: specs/008-user-registration/plan.md

- [ ] T1. Install bcrypt dependency
    - Red: none — this is a dependency-change task, not a code test (per
      `spec-planner`'s "dependency-change tasks come before the code that
      needs them"). Confirm the gap first: `bcrypt`/`@types/bcrypt` are
      absent from `package.json`.
    - Green: `npm install bcrypt@^6.0.0` and
      `npm install -D @types/bcrypt@^6.0.0` per plan.md §8.
    - Covers: enables AC1/AC8 (password hashing is a precondition for every
      later task in this file).

- [ ] T2. Use case registers and returns the assembled account when the email is not in use
    - Red: `tests/unit/logic/user/application/RegisterUserUseCase.test.ts` —
      construct `RegisterUserUseCase` with `mock<UserRepositoryInterface>()`
      and `mock<PasswordHasherInterface>()` (per `testing` skill); set
      `userRepository.findByEmail.mockResolvedValue(undefined)`,
      `passwordHasher.hash.mockResolvedValue('hashed-password')`, and
      `userRepository.create.mockResolvedValue(undefined)`; build a
      `RegisterUserQuery` fixture (all fields via faker); call
      `useCase.invoke(query)`; assert the result equals
      `{ id: query.id, name: query.name, email: query.email, createdAt: query.createdAt, updatedAt: query.updatedAt }`
      (no `passwordHash` property); assert `passwordHasher.hash` was called
      once with `query.password`; assert `userRepository.create` was called
      once with
      `{ id: query.id, name: query.name, email: query.email, passwordHash: 'hashed-password', createdAt: query.createdAt, updatedAt: query.updatedAt }`.
      Fails: `User`, `RegisterUserQuery`/`RegisterUserResponse`,
      `RegisterUserUseCase`, `UserRepositoryInterface`, and
      `PasswordHasherInterface` do not exist yet.
    - Green: create `src/logic/user/domain/User.ts`,
      `src/logic/user/domain/interfaces/UserRepositoryInterface.ts`,
      `src/logic/user/domain/interfaces/PasswordHasherInterface.ts`, and
      `src/logic/user/application/RegisterUserUseCase.ts` per plan.md §2–§4,
      hashing the password via the port, assembling the `User`, calling
      `create()`, and returning the password-free response.
    - Covers: AC1 "Given a name, an email not already used by any existing
      account, and a password meeting the password requirement are supplied,
      When the visitor creates an account, Then a new account is created and
      the response includes its id, name, email, createdAt, and updatedAt,
      and never includes the password."

- [ ] T3. Use case throws EmailAlreadyInUseError and does not persist when the email is already in use
    - Red: same file as T2 — new `it`;
      `userRepository.findByEmail.mockResolvedValue(existingUserFixture)`
      (any `User`-shaped object); build a `RegisterUserQuery` fixture; call
      `useCase.invoke(query)`; assert
      `await expect(useCase.invoke(query)).rejects.toThrow(EmailAlreadyInUseError)`
      and `.rejects.toThrow('Email already in use: ' + query.email)` (per
      `testing` skill — asserting both error type and message); assert
      `passwordHasher.hash` and `userRepository.create` were never called.
    - Green: create `src/logic/user/domain/errors/EmailAlreadyInUseError.ts`
      per plan.md §2; `RegisterUserUseCase.invoke()` throws
      `new EmailAlreadyInUseError(query.email)` before calling
      `passwordHasher.hash`/`userRepository.create` when
      `userRepository.findByEmail` resolves a defined `User`.
    - Covers: AC8 "Given the supplied email already belongs to an existing
      account, comparing without regard to letter case, When the visitor
      attempts to create an account, Then the visitor is told the email is
      already in use (E1), and no new account is created."

- [ ] T4. BcryptPasswordHasher produces a verifiable hash, never the plaintext password
    - Red: `tests/integration/logic/user/infrastructure/BcryptPasswordHasher.test.ts` —
      construct `new BcryptPasswordHasher()`; call `hash('Sup3r$ecret!')`;
      assert the result is a defined string not equal to `'Sup3r$ecret!'`;
      assert `await bcrypt.compare('Sup3r$ecret!', result)` resolves `true`.
      Fails: `BcryptPasswordHasher` does not exist yet.
    - Green: create `src/logic/user/infrastructure/BcryptPasswordHasher.ts`
      per plan.md §7, calling `bcrypt.hash(password, 10)`.
    - Covers: AC1 (see T2 text above) — the password-hashing mechanism the
      use case depends on.

- [ ] T5. User repository persists a new account row
    - Red: `tests/integration/logic/user/infrastructure/database/DrizzleUserRepository.test.ts` —
      per `testing` skill integration conventions, open the connection once
      in `beforeAll`; build a full `User` fixture via a
      `userModelFactory.create()` (new factory, see T5 Green); call
      `new DrizzleUserRepository(db).create(fixture)`; select the row
      directly via a new `tests/lib/database/users.ts` `selectUsersByIds`
      helper; assert it equals the fixture's fields mapped to columns
      (`password_hash` for `passwordHash`); delete the inserted row in
      `afterEach`. Fails: `users` table/schema, `DrizzleUserRepository`, the
      model factory, and the database helper do not exist yet.
    - Green: define the `users` table (with the `users_email_lower_unique`
      index) in `src/logic/user/infrastructure/database/schema.ts`; register
      it in `src/config.ts`'s `database.schema` aggregation; generate and
      apply the migration (`npx drizzle-kit generate`, `npx drizzle-kit
      migrate`) per plan.md §7; implement
      `src/logic/user/infrastructure/database/DrizzleUserRepository.ts`'s
      `create()`; add `tests/lib/modelFactories/UserModelFactory.ts` (fields:
      `id`, `name`, `email`, `passwordHash`, `createdAt`, `updatedAt`, via
      faker) and export a singleton `userModelFactory` from
      `tests/lib/config.ts`; add
      `tests/lib/database/users.ts` (`insertUsers`, `deleteUsersByIds`,
      `selectUsersByIds`, mirroring `tests/lib/database/prompts.ts`).
    - Covers: AC1 (see T2 text above).

- [ ] T6. User repository finds an account by email, case-insensitively
    - Red: same file as T5 — new `describe('findByEmail', ...)`; insert a
      fixture user via `insertUsers` with a mixed-case email (e.g.
      `'Ada.Fixture@Example.com'`); call
      `repository.findByEmail('ada.fixture@example.com')` (different case);
      assert the result equals the fixture, with `email` still exactly
      `'Ada.Fixture@Example.com'` (not lowercased); clean up the inserted row
      in `afterEach`.
    - Green: implement `DrizzleUserRepository.findByEmail()` per plan.md §7,
      comparing via `sql`lower(...) = lower(...)``.
    - Covers: AC8, AC9 (see T3/T9 texts).

- [ ] T7. User repository returns undefined when no account matches the email
    - Red: same file as T5 — new `it` inside `findByEmail`; call
      `repository.findByEmail(faker.internet.email())` with no matching
      inserted row; assert the result is `undefined`.
    - Green: no production change expected; T6's query naturally returns no
      rows for a non-matching email. Run the test to confirm.
    - Covers: AC1 (see T2 text above) — confirms the "not already used"
      precondition path returns cleanly with no false positive.

- [ ] T8. `POST /users` creates and returns the new account
    - Red: `tests/integration/handlers/RegisterUserHandler.test.ts` — new
      top-level `describe('POST /users', ...)`; using `supertest` against the
      real Express `app`, `POST /users` with
      `{ name: 'Fixture Name', email: '<unique fixture email>', password: 'Sup3r$ecret!' }`;
      assert status `201`; assert the JSON body matches
      `{ name: payload.name, email: payload.email }`, has a defined `id`, and
      `createdAt === updatedAt`; assert the body has no `password`/
      `passwordHash` property; clean up the created row afterward using
      `response.body.id` with `deleteUsersByIds`. Fails: no `POST /users`
      route, handler, use-case wiring, or schema exists yet.
    - Green: create `src/schemas/RegisterUserSchema.ts` per plan.md §6;
      create `src/handlers/RegisterUserHandler.ts` that reads
      `req.parsedRequest?.body`, generates `id` via `randomUUID()` and
      `createdAt`/`updatedAt` via a single `new Date()` call, calls
      `registerUserUseCase.invoke(...)` inside a `try/catch`, and responds
      `201` with the JSON account on success; create
      `src/logic/user/services.ts` wiring `DrizzleUserRepository` and
      `BcryptPasswordHasher` into `registerUserUseCase`; register
      `app.post('/users', validateRequestMiddleware(RegisterUserSchema), registerUserHandler)`
      in `src/app.ts`.
    - Covers: AC1 (see T2 text above).

- [ ] T9. `POST /users` creates an account for a mixed-case email with no existing match, preserving its case
    - Red: same file as T8 — new `it`; `POST /users` with
      `{ name: 'Fixture Name', email: 'Fixture.Mixed.Case@Example.com', password: 'Sup3r$ecret!' }`
      (an email guaranteed not to already exist); assert status `201` and the
      response's `email` is exactly `'Fixture.Mixed.Case@Example.com'`, not
      lowercased or otherwise changed in case; clean up the created row
      afterward.
    - Green: no production change expected; confirm the write path (T5–T8)
      never lowercases the stored/returned `email`.
    - Covers: AC9 "Given an email containing uppercase letters is supplied
      and does not match any existing account when compared without regard
      to letter case, When the visitor creates an account, Then the account
      is created and the response's email is exactly what was supplied, not
      changed in letter case."

- [ ] T10. `POST /users` returns an email-already-in-use error when the email already exists, case-insensitively
    - Red: same file as T8 — new `it`; seed an existing user directly via
      `insertUsers` with email `'Existing.Fixture@Example.com'`; `POST /users`
      with `{ name: 'Another Name', email: 'existing.fixture@example.com', password: 'Sup3r$ecret!' }`
      (different case); assert status `409` and the JSON body equals
      `{ error: 'Email already in use: existing.fixture@example.com' }`;
      clean up the seeded row afterward; assert no second row exists for that
      email via `selectUsersByIds`/a direct lookup (only the one seeded row).
    - Green: `RegisterUserHandler.ts`'s `catch` block catches
      `EmailAlreadyInUseError` specifically and responds
      `res.status(409).json({ error: err.message })`; any other error is
      re-thrown, not swallowed (plan.md §5).
    - Covers: AC8 (see T3 text above).

- [ ] T11. `POST /users` Request Validation — returns missing-field errors for an empty body
    - Red: same file as T8 — nested `describe('Request Validation', ...)`
      per `testing` skill's Request Validation convention; `POST /users`
      with `{}`; assert status `400` and the body's `errors` array contains
      exactly `{ field: 'body.name', error: 'Missing required value' }`,
      `{ field: 'body.email', error: 'Missing required value' }`, and
      `{ field: 'body.password', error: 'Missing required value' }` (exact
      object literals, per `testing` skill).
    - Green: none beyond T8 — `RegisterUserSchema.body`'s `z.object` already
      reports all three missing required fields together via the existing
      `validateRequestMiddleware` mechanism.
    - Covers: AC2 "Given the name is missing or blank... the visitor is told
      the name is missing (V1)..."; AC3 "Given the email is missing... the
      visitor is told the email is missing (V2)..."; AC5 "Given the password
      is missing... the visitor is told the password is missing (V3)...";
      AC7 "Given more than one of name, email, and password are missing or
      invalid at once, When the visitor attempts to create an account, Then
      the visitor is told about every one of those problems together
      (V1/V2/V3), not only the first one found, and no account is created."

- [ ] T12. `POST /users` Request Validation — returns a missing-value error for a blank name
    - Red: same file as T8, inside the `Request Validation` describe — new
      `it`; `POST /users` with
      `{ name: '   ', email: 'blank.name.fixture@example.com', password: 'Sup3r$ecret!' }`;
      assert status `400` and the body's `errors` array contains exactly
      `{ field: 'body.name', error: 'Missing required value' }`.
    - Green: none beyond T8 — `RegisterUserSchema.body.name`'s
      `.refine((value) => value.trim().length > 0, ...)` already rejects a
      whitespace-only value.
    - Covers: AC2 (see T11 text above).

- [ ] T13. `POST /users` Request Validation — returns an invalid-value error for a malformed email
    - Red: same file as T8, inside the `Request Validation` describe — new
      `it`; `POST /users` with
      `{ name: 'Fixture Name', email: 'not-an-email', password: 'Sup3r$ecret!' }`;
      assert status `400` and the body's `errors` array contains exactly
      `{ field: 'body.email', error: 'Invalid email address' }`.
    - Green: none beyond T8 — `RegisterUserSchema.body.email: z.email(...)`
      already rejects a non-email-shaped value.
    - Covers: AC4 "Given the email is supplied but is not shaped like a valid
      email address... the visitor is told the email is invalid (V2)..."

- [ ] T14. `POST /users` Request Validation — returns a requirement error for a weak password
    - Red: same file as T8, inside the `Request Validation` describe — new
      `it`; `POST /users` with
      `{ name: 'Fixture Name', email: 'weak.password.fixture@example.com', password: 'short' }`;
      assert status `400` and the body's `errors` array contains exactly
      `{ field: 'body.password', error: 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a digit, and a special character.' }`.
    - Green: none beyond T8 — `RegisterUserSchema.body.password`'s
      `.regex(PASSWORD_REQUIREMENT_REGEX, ...)` already rejects a value not
      meeting the requirement.
    - Covers: AC6 "Given the password is supplied but does not meet the
      password requirement (e.g. it is too short, or lacks an uppercase
      letter, a lowercase letter, a digit, or a special character)... the
      visitor is told the password requirement that must be met (V3)..."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | --- | --- |
| AC1 | Given a name, an email not already used by any existing account, and a password meeting the password requirement are supplied, When the visitor creates an account, Then a new account is created and the response includes its id, name, email, createdAt, and updatedAt, and never includes the password. | T2, T4, T5, T7, T8 |
| AC2 | Given the name is missing or blank, When the visitor attempts to create an account, Then the visitor is told the name is missing (V1), and no account is created. | T11, T12 |
| AC3 | Given the email is missing, When the visitor attempts to create an account, Then the visitor is told the email is missing (V2), and no account is created. | T11 |
| AC4 | Given the email is supplied but is not shaped like a valid email address, When the visitor attempts to create an account, Then the visitor is told the email is invalid (V2), and no account is created. | T13 |
| AC5 | Given the password is missing, When the visitor attempts to create an account, Then the visitor is told the password is missing (V3), and no account is created. | T11 |
| AC6 | Given the password is supplied but does not meet the password requirement (e.g. it is too short, or lacks an uppercase letter, a lowercase letter, a digit, or a special character), When the visitor attempts to create an account, Then the visitor is told the password requirement that must be met (V3), and no account is created. | T14 |
| AC7 | Given more than one of name, email, and password are missing or invalid at once, When the visitor attempts to create an account, Then the visitor is told about every one of those problems together (V1/V2/V3), not only the first one found, and no account is created. | T11 |
| AC8 | Given the supplied email already belongs to an existing account, comparing without regard to letter case, When the visitor attempts to create an account, Then the visitor is told the email is already in use (E1), and no new account is created. | T3, T6, T10 |
| AC9 | Given an email containing uppercase letters is supplied and does not match any existing account when compared without regard to letter case, When the visitor creates an account, Then the account is created and the response's email is exactly what was supplied, not changed in letter case. | T6, T9 |