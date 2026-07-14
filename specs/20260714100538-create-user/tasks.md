# Tasks: Create user
Plan: specs/20260714100538-create-user/plan.md

<!-- All business logic (RegisterUserUseCase, DrizzleUserRepository, email-uniqueness
check, password hashing) already exists and is unit-tested; this feature is the HTTP
layer only. Tasks are integration tests (supertest + real DB) against src/app.ts,
mirroring the createPromptHandler precedent. New POST tests all live in
tests/integration/handlers/users/createUserHandler.test.ts. Each test constructs a
DatabaseClient<DatabaseSchema> inline from @src/config/config.js +
@src/config/drizzle-schema.js and calls databaseClient.connect(); seed/verify/cleanup
users via the tests/lib/database/users helpers (insertUsers, selectUsersByIds,
deleteUsersByIds) with userModelFactory. -->

- [ ] T1. `POST /users` creates a user and returns 201 with the stored user
  - Type: route handler
  - Depends on: none
  - Red: new integration test `tests/integration/handlers/users/createUserHandler.test.ts`
    — construct a `DatabaseClient<DatabaseSchema>` inline and `databaseClient.connect()`
    (mirroring `createPromptHandler.test.ts`); `request(app).post('/users').send({ name,
    email, password })` (a well-formed body, password ≥ 8 chars, email not seeded).
    Assert status `201` and body equals `{ id: <any string>, name, email, created_at,
    updated_at }` (snake_case keys; `created_at`/`updated_at` ISO strings, `id` present;
    **no** `password` key and **no** camelCase `createdAt`/`updatedAt`); then verify
    persistence with `selectUsersByIds(db, [response.body.id])` (one row, matching
    `name`/`email`, and whose `passwordHash` is present and **not equal** to the submitted
    plain-text password). Track the created id and clean it up via `deleteUsersByIds` in
    `afterEach`. Fails first because no `POST /users` route exists (Express 404).
  - Green: create `src/routes/users.schema.ts` exporting `CreateUserSchema =
    z.object({ body: z.object({ name: z.string({ error: 'Missing required value' }).min(1,
    'Missing required value'), email: z.email({ error: (issue) => issue.code ===
    'invalid_type' ? 'Missing required value' : 'Invalid email value' }), password:
    z.string({ error: 'Missing required value' }).min(8, 'Must be at least 8 characters')
    }) })` and `type CreateUserRequest = z.infer<typeof CreateUserSchema>`; create
    `src/handlers/users/createUserHandler.ts` (`const createUserHandler: RequestHandler`
    → read `const { body } = req.parsedRequest as CreateUserRequest`, `const user = await
    registerUserUseCase.invoke({ name: body.name, email: body.email, password:
    body.password })`, then `res.status(201).json({ id: user.id, name: user.name, email:
    user.email, created_at: user.createdAt, updated_at: user.updatedAt })`; `export
    default`); create `src/routes/users.routes.ts` with `usersRouter.post('/users',
    validateRequestMiddleware(CreateUserSchema), createUserHandler)`; mount it in
    `src/routes/index.ts` via `apiRouter.use(usersRouter)`.
  - Covers: AC1 "Given a well-formed request whose email is not already in use, When the
    client creates a user, Then the user is stored with a newly assigned identifier, a
    securely stored (non-plain-text) password, and creation/last-updated moments, and the
    response indicates a new resource was created and contains the stored user: id, name,
    email, created_at and updated_at, and never the password." (V1, V2, V3, V4 happy path)

- [ ] T2. Missing required field is rejected as a 400 validation failure
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `createUserHandler.test.ts` — POST a body omitting `name` (valid
    `email` + valid `password`); assert status `400` and body equals `{ error:
    'RequestValidationError', message: 'Request Validation data failed', details: { body: {
    name: <reason string> } } }` (assert `details.body.name` is a non-empty string), and
    that no user was stored (`selectUsersByIds` for any created id is empty / no row for
    that email). Fails first before T1's route/schema exist.
  - Green: no new code beyond T1 — `validateRequestMiddleware(CreateUserSchema)` +
    existing `errorMiddleware` already produce this contract; the schema's required
    `name` drives it.
  - Covers: AC2 "Given a request that omits a required field, sends a non-text value,
    sends a malformed email, or sends a password shorter than the minimum length, When
    the client attempts to create a user, Then the request is rejected as a validation
    failure whose reasons name each offending field with a human-readable reason grouped
    under the body, and no user is stored." (V1, E1)

- [ ] T3. Malformed email is rejected as 400 before the uniqueness check
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `createUserHandler.test.ts` — POST a well-formed body whose
    `email` is not a valid email (e.g. `"not-an-email"`), with a valid `name`/`password`;
    assert status `400` and `details.body.email` is a non-empty reason string (the
    request-validation envelope, **not** the 422 email-in-use envelope), confirming V2
    gates before any email lookup. Fails first before T1's schema exists.
  - Green: no new code beyond T1 — `z.email()` on `email` drives the 400.
  - Covers: AC2 (the malformed-email case) "... sends a malformed email ... Then the
    request is rejected as a validation failure ... and no user is stored." (V2, E1)

- [ ] T4. Too-short password is rejected as a 400 validation failure
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `createUserHandler.test.ts` — POST a well-formed body whose
    `password` is shorter than 8 characters (e.g. `"abc"`), with a valid `name`/`email`;
    assert status `400` and `details.body.password` is a non-empty reason string, and
    that no user was stored. Fails first before T1's schema exists.
  - Green: no new code beyond T1 — `z.string().min(8)` on `password` drives the 400.
  - Covers: AC2 (the too-short-password case) "... or sends a password shorter than the
    minimum length ... Then the request is rejected as a validation failure ... and no
    user is stored." (V3, E1)

- [ ] T5. Already-used email returns 422 email-already-in-use
  - Type: middleware
  - Depends on: T1
  - Red: add an `it` to `createUserHandler.test.ts` — seed one user via `insertUsers`
    (`userModelFactory`) with a known email, then POST a well-formed body reusing **that
    same email** (with a fresh valid `name`/`password`); assert status `422` and body
    equals `{ error: 'EmailAlreadyInUseError', message: \`Email already in use: <that
    email>\` }`, and that no **new** user was stored (only the seeded row exists for that
    email). Fails first because the current `errorMiddleware` maps `EmailAlreadyInUseError`
    to the generic `500`, not `422`.
  - Green: add a branch to `src/middleware/errorMiddleware.ts` — `if (err instanceof
    EmailAlreadyInUseError) { res.status(422).json({ error: err.name, message:
    err.message }); return; }` (import `EmailAlreadyInUseError` from
    `@src/modules/user/domain/errors/EmailAlreadyInUseError.js`), placed before the
    generic `500` fallback.
  - Covers: AC3 "Given a well-formed request whose email is already used by an existing
    user, When the client attempts to create a user, Then the request is rejected as an
    email-already-in-use failure that names the conflicting email, distinct from a
    validation failure and without per-field reasons, and no new user is stored." (V4, E2)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a well-formed request whose email is not already in use, When the client creates a user, Then the user is stored with a newly assigned identifier, a securely stored (non-plain-text) password, and creation/last-updated moments, and the response indicates a new resource was created and contains the stored user: id, name, email, created_at and updated_at, and never the password. | T1 |
| AC2 | Given a request that omits a required field, sends a non-text value, sends a malformed email, or sends a password shorter than the minimum length, When the client attempts to create a user, Then the request is rejected as a validation failure whose reasons name each offending field (by its snake_case name) with a human-readable reason grouped under the body, and no user is stored. | T2, T3, T4 |
| AC3 | Given a well-formed request whose email is already used by an existing user, When the client attempts to create a user, Then the request is rejected as an email-already-in-use failure that names the conflicting email, distinct from a validation failure and without per-field reasons, and no new user is stored. | T5 |
| AC4 | Given a well-formed request whose email is free but whose storage fails unexpectedly, When the client attempts to create a user, Then the client is told a generic internal error occurred, distinct from a validation or email-already-in-use failure. | Existing coverage — `tests/integration/middleware/errorMiddleware.test.ts` "renders a generic internal error for a non-validation failure" already proves `errorMiddleware`'s generic `500` branch (E3), which `UserCreationError` and any other non-mapped error fall through to unchanged. No new task (a real-DB storage failure cannot be provoked deterministically in integration; the branch is proven in isolation). |
