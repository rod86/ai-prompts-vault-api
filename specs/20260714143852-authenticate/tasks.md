# Tasks: Authenticate (login and get a token)
Plan: specs/20260714143852-authenticate/plan.md

<!-- All business logic (LoginUseCase, DrizzleUserCredentialsRepository, password
comparison, token issuing) already exists and is unit-tested; this feature is the HTTP
layer only. Tasks are integration tests (supertest + real DB) against src/app.ts,
mirroring the createUserHandler precedent. New tests all live in
tests/integration/handlers/auth/authenticateHandler.test.ts. Each test constructs a
DatabaseClient<DatabaseSchema> inline from @src/config/config.js +
@src/config/drizzle-schema.js and calls databaseClient.connect(). A login-able user is
seeded via the tests/lib/database/users helpers (insertUsers, deleteUsersByIds) with
userModelFactory, overriding passwordHash with a REAL bcrypt hash of a known password
(at least 8 chars) produced by the shared `passwordHasher`
(@src/modules/shared/services.js) so that LoginUseCase's compare succeeds — the
factory's default passwordHash is random and would never match. Clean up seeded ids via
deleteUsersByIds in afterAll. Validation is the same shape as CreateUserSchema
(Decision D3). -->

- [x] T1. `POST /authenticate` issues a token and returns 200 for valid credentials
  - Type: route handler
  - Depends on: none
  - Red: new integration test `tests/integration/handlers/auth/authenticateHandler.test.ts`
    — construct a `DatabaseClient<DatabaseSchema>` inline and `databaseClient.connect()`
    (mirroring `createUserHandler.test.ts`); in `beforeAll`, seed one user via
    `insertUsers` with a known `email` and `passwordHash: await passwordHasher.hash(<known
    password ≥ 8 chars>)` (import `passwordHasher` from `@src/modules/shared/services.js`).
    Then `request(app).post('/authenticate').send({ email: <that email>, password: <that
    known password> })`. Assert status `200` and that the body equals `{ token: <any
    non-empty string> }` (assert `body.token` is a non-empty string; assert there is
    **no** `password` key and no other fields). Clean up the seeded id via
    `deleteUsersByIds` in `afterAll`. Fails first because no `POST /authenticate` route
    exists (Express 404).
  - Green: create `src/routes/auth.schema.ts` exporting `AuthenticateSchema =
    z.object({ body: z.object({ email: z.email({ error: (issue) => issue.code ===
    'invalid_type' ? 'Missing required value' : 'Invalid email value' }), password:
    z.string({ error: 'Missing required value' }).min(8, 'Must be at least 8 characters')
    }) })` and `type AuthenticateRequest = z.infer<typeof AuthenticateSchema>`; create
    `src/handlers/auth/authenticateHandler.ts` (`const authenticateHandler: RequestHandler`
    → read `const { body } = req.parsedRequest as AuthenticateRequest`, `const result =
    await loginUseCase.invoke({ email: body.email, password: body.password })` (import
    `loginUseCase` from `@src/modules/auth/services.js`), then `res.status(200).json({
    token: result.token })`; `export default`); create `src/routes/auth.routes.ts` with
    `authRouter.post('/authenticate', validateRequestMiddleware(AuthenticateSchema),
    authenticateHandler)`; mount it in `src/routes/index.ts` via `apiRouter.use(authRouter)`.
  - Covers: AC1 "Given a well-formed request whose email identifies an existing account
    and whose password matches that account's stored secret, When the user authenticates,
    Then an access token identifying the account is issued and returned as { token }, and
    no other data (and never the password) is returned." (V1, V2 happy path)

- [x] T2. Missing or empty required field is rejected as a 400 validation failure
  - Type: route handler
  - Depends on: T1
  - Red: add `it`s to `authenticateHandler.test.ts` — (a) POST a body omitting `email`
    (valid `password`); (b) POST a body omitting `password` (valid `email`). For each,
    assert status `400` and body equals `{ error: 'RequestValidationError', message:
    'Request Validation data failed', details: { body: { <field>: <reason> } } }` (assert
    `details.body.<offending field>` is a non-empty string), and that no token is returned
    (`body.token` is undefined). Fails first before T1's route/schema exist.
  - Green: no new code beyond T1 — `validateRequestMiddleware(AuthenticateSchema)` +
    existing `errorMiddleware` already produce this contract; the schema's required
    `email`/`password` drive it.
  - Covers: AC2 (the missing-field case) "Given a request that omits ... `email`, or omits
    ... `password` ... Then the request is rejected as a validation failure whose reasons
    name each offending field ... and no token is issued." (V1, V2, E1)

- [x] T3. Malformed email is rejected as a 400 validation failure before any credential check
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `authenticateHandler.test.ts` — POST a body whose `email` is not
    a valid email (e.g. `"not-an-email"`) with a valid `password` (≥ 8 chars); assert
    status `400` and `details.body.email` is a non-empty reason string (the
    request-validation envelope, **not** the 401 invalid-credentials envelope),
    confirming V1 gates before any credential lookup, and that no token is returned. Fails
    first before T1's schema exists.
  - Green: no new code beyond T1 — `z.email()` on `email` drives the 400.
  - Covers: AC2 (the malformed-email case) "Given a request that ... sends a malformed
    `email` ... Then the request is rejected as a validation failure ... and no token is
    issued." (V1, E1)

- [x] T4. Too-short password is rejected as a 400 validation failure
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `authenticateHandler.test.ts` — POST a body whose `password` is
    shorter than 8 characters (e.g. `"abc"`) with a valid `email`; assert status `400`
    and `details.body.password` is a non-empty reason string, and that no token is
    returned. Fails first before T1's schema exists.
  - Green: no new code beyond T1 — `z.string().min(8)` on `password` drives the 400.
  - Covers: AC2 (the too-short-password case) "Given a request that ... sends a
    shorter-than-minimum-length `password` ... Then the request is rejected as a
    validation failure ... and no token is issued." (V2, E1)

- [ ] T5. Unknown email is rejected as 401 invalid credentials
  - Type: middleware
  - Depends on: T1
  - Red: add an `it` to `authenticateHandler.test.ts` — POST a well-formed body whose
    `email` matches no seeded account (a fresh unique valid email) with a valid `password`
    (≥ 8 chars); assert status `401` and body equals `{ error: 'InvalidCredentialsError',
    message: 'Invalid authentication credentials' }`, and no token is returned. Fails
    first because the current `errorMiddleware` maps `InvalidCredentialsError` to the
    generic `500`, not `401`.
  - Green: add a branch to `src/middleware/errorMiddleware.ts` — `if (err instanceof
    InvalidCredentialsError) { res.status(401).json({ error: err.name, message:
    err.message }); return; }` (import `InvalidCredentialsError` from
    `@src/modules/auth/domain/errors/InvalidCredentialsError.js`), placed alongside the
    existing token-error `401` branches, before the generic `500` fallback.
  - Covers: AC3 "Given a well-formed request whose email does not identify any existing
    account, When the user attempts to authenticate, Then the request is rejected as an
    invalid-credentials failure with a generic message, distinct from a validation failure
    and without per-field reasons, and no token is issued." (E2, unknown email)

- [ ] T6. Wrong password is rejected as 401, identical to the unknown-email response
  - Type: route handler
  - Depends on: T5
  - Red: add an `it` to `authenticateHandler.test.ts` — reusing the seeded user from T1
    (known `email`), POST a well-formed body with that `email` but a **wrong** valid-length
    (≥ 8 chars) `password`; assert status `401` and body equals `{ error:
    'InvalidCredentialsError', message: 'Invalid authentication credentials' }` —
    byte-for-byte identical to the unknown-email response in T5 — and no token is
    returned. With T5's branch in place this passes; it locks in that the two E2 causes
    are indistinguishable.
  - Green: no new code beyond T1 and T5 — `LoginUseCase` throws the same
    `InvalidCredentialsError` for a password mismatch, mapped by T5's `401` branch.
  - Covers: AC4 "Given a well-formed request whose email identifies an existing account
    but whose password does not match that account's stored secret, When the user attempts
    to authenticate, Then the request is rejected as an invalid-credentials failure whose
    response is identical to the unknown-email case (AC3) — revealing nothing about which
    condition occurred — and no token is issued." (E2, wrong password)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a well-formed request whose email identifies an existing account and whose password matches that account's stored secret, When the user authenticates, Then an access token identifying the account is issued and returned as { token }, and no other data (and never the password) is returned. | T1 |
| AC2 | Given a request that omits, sends an empty/non-text, or sends a malformed email, or omits, sends an empty/non-text, or sends a shorter-than-minimum-length password, When the user attempts to authenticate, Then the request is rejected as a validation failure whose reasons name each offending field (by its snake_case name) with a human-readable reason grouped under the body, and no token is issued. | T2, T3, T4 |
| AC3 | Given a well-formed request whose email does not identify any existing account, When the user attempts to authenticate, Then the request is rejected as an invalid-credentials failure with a generic message, distinct from a validation failure and without per-field reasons, and no token is issued. | T5 |
| AC4 | Given a well-formed request whose email identifies an existing account but whose password does not match that account's stored secret, When the user attempts to authenticate, Then the request is rejected as an invalid-credentials failure whose response is identical to the unknown-email case (AC3) — revealing nothing about which condition occurred — and no token is issued. | T6 |
