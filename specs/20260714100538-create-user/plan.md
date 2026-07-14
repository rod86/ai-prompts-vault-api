# Plan: Create user
Spec: specs/20260714100538-create-user/spec.md

## 1. Approach
This feature is purely the **HTTP layer** over an already-built use case. The
`RegisterUserUseCase` (`src/modules/user/application/RegisterUserUseCase.ts`) already
checks the email is free (throwing `EmailAlreadyInUseError`), hashes the password via
the shared `PasswordHasherInterface`, generates the id + timestamps, persists via
`DrizzleUserRepository.create`, wraps storage failures in `UserCreationError`, and
returns `{ id, name, email, createdAt, updatedAt }` (the password hash is **not** in the
return shape). It is already wired as `registerUserUseCase` in
`src/modules/user/services.ts`. No domain, application, infrastructure, or migration
work is needed.

Client-facing field names are **snake_case** (spec D6), while the domain use case is
camelCase (`RegisterUserResponse.createdAt`/`updatedAt`). The handler therefore **maps
at the HTTP boundary** — `createdAt/updatedAt → created_at/updated_at` on the way out —
rather than passing the response through one-to-one. The submitted body fields
(`name`, `email`, `password`) are single-word and map to `RegisterUserQuery` unchanged.
The mapping is done **inline in the handler** (mirroring `createPromptHandler`); no
serializer module.

We add, following the `node-express-typescript` skill and the existing
`createPromptHandler` precedent:
1. A request-validation **schema** for the create body, in `src/routes/`, whose fields
   are the snake_case wire names (here all single-word: `name`, `email`, `password`).
2. A **handler** (`createUserHandler`) that reads the validated body from
   `req.parsedRequest`, maps it to the `RegisterUserQuery`, calls
   `registerUserUseCase.invoke`, and responds `201` with the returned user mapped to
   the snake_case response shape (never including the password).
3. A new **router** `usersRouter` with a route `POST /users`, guarded by
   `validateRequestMiddleware(CreateUserSchema)`, mounted on the `apiRouter`.
4. An extension of the central `errorMiddleware` to map `EmailAlreadyInUseError` → `422`
   (E2). Validation (E1) and generic-internal (E3) are already handled by the existing
   middleware.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `CreateUserSchema` (+ inferred type) | **new** | `src/routes/users.schema.ts` | Zod schema `{ body: { name (non-empty), email (email), password (min 8) } }` — snake_case wire names; export `CreateUserRequest = z.infer<...>` for the handler. |
| `createUserHandler` | **new** | `src/handlers/users/createUserHandler.ts` | Reads validated body off `req.parsedRequest`, maps to the `RegisterUserQuery` `{ name, email, password }`, calls `registerUserUseCase.invoke`, maps the returned user to the snake_case response (`created_at`/`updated_at`), responds `201`. `export default`. |
| `usersRouter` | **new** | `src/routes/users.routes.ts` | `usersRouter.post('/users', validateRequestMiddleware(CreateUserSchema), createUserHandler)`. |
| `apiRouter` | existing | `src/routes/index.ts` | `apiRouter.use(usersRouter)` alongside the existing `promptsRouter`. |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Add a branch: `EmailAlreadyInUseError` → `422 { error: err.name, message: err.message }`. |
| `RegisterUserUseCase` / `registerUserUseCase` | existing | `.../application/RegisterUserUseCase.ts`, `.../user/services.ts` | **No change** — reused as-is. |
| `EmailAlreadyInUseError` | existing | `.../user/domain/errors/EmailAlreadyInUseError.ts` | **No change** — imported by `errorMiddleware`. |

`RegisterUserQuery` (the use case input) is `{ name, email, password }` — the validated
snake_case body maps to it directly (all three names are single-word, unchanged).

## 3. Interfaces & contracts
Request: `POST /users`, JSON body `{ name: string, email: string(email), password: string(min 8) }`.

`CreateUserSchema` (validator contract — `RequestSchema` shape):
```
z.object({
  body: z.object({
    name: z.string({ error: 'Missing required value' }).min(1, 'Missing required value'),
    email: z.email({
      error: (issue) =>
        issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid email value',
    }),
    password: z.string({ error: 'Missing required value' }).min(8, 'Must be at least 8 characters'),
  }),
})
```
Handler: reads `req.parsedRequest as CreateUserRequest`, calls
`registerUserUseCase.invoke({ name: body.name, email: body.email, password: body.password })`,
then maps the returned user to the snake_case response and `res.status(201).json(response)`.

Success response `201`:
```
{ id, name, email, created_at, updated_at }
```
(`created_at`/`updated_at` are the camelCase `createdAt`/`updatedAt` renamed, serialized
as ISO strings by `res.json`. `password` is never present — it is not on the use case's
return shape.)

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `RequestValidationError` (thrown by `validateRequestMiddleware`) | `400 { error: 'RequestValidationError', message: 'Request Validation data failed', details: { body: { <field>: <reason> } } }` — existing behavior. |
| E2 | `EmailAlreadyInUseError` (thrown by `RegisterUserUseCase`) | `422 { error: 'EmailAlreadyInUseError', message: 'Email already in use: <email>' }` — new `errorMiddleware` branch. |
| E3 | `UserCreationError` / any other error | `500 { error: 'InternalServerError', message: 'Internal server error' }` — existing default branch. |

## 4. Data & persistence
None. No schema or migration changes. Persistence is the existing `users` table via
`DrizzleUserRepository.create`, reused unchanged (`id` app-provided; `name`, `email`,
`passwordHash`, `createdAt`, `updatedAt`). The table's `users_email_lower_unique` index
already enforces case-insensitive email uniqueness at the DB level as a backstop.

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `name` required non-empty text | `CreateUserSchema.body.name` (`z.string().min(1)`) via `validateRequestMiddleware` | → E1 |
| V2 | `email` required, well-formed email | `CreateUserSchema.body.email` (`z.email()`) | → E1 |
| V3 | `password` required text, min 8 chars | `CreateUserSchema.body.password` (`z.string().min(8)`) | → E1 |
| V4 | submitted email must be unused | `RegisterUserUseCase.invoke` (`userRepository.findByEmail` → `EmailAlreadyInUseError`) — existing | → E2 |

## 6. Dependency changes
None. `zod`, `express`, `supertest`, and all middleware/use cases are already present.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks
Assumptions (trivial, decided silently):
1. Route path is `POST /users` on a new `usersRouter` (mounted at root, no prefix),
   mirroring `POST /prompts`. — consequence if wrong: path differs; trivial to adjust.
2. Unknown/extra body properties are stripped by the schema (Zod object default), not
   rejected — mirroring `CreatePromptSchema`. — consequence if wrong: strict rejection
   would need `.strict()` and an extra test.
3. The handler consumes the validated body via `req.parsedRequest as CreateUserRequest`
   (the middleware sets `parsedRequest`, typed `unknown`), mirroring `createPromptHandler`;
   no change to `express.d.ts`. — consequence if wrong: a typed accessor is a separate concern.
4. `res.json` serialization of the mapped `Date` values (`created_at`/`updated_at`) to
   ISO strings is the intended wire format, consistent with the rest of the app.
5. The email-uniqueness check trusts the use case's `findByEmail` + `EmailAlreadyInUseError`
   path; the DB unique index is a backstop whose violation surfaces as E3, not E2 (a
   race that the integration test does not attempt to provoke).

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `errorMiddleware` importing a user-domain error class couples the HTTP layer to a module's domain. | low | low | The middleware is an unclassified boundaries element — it already imports `CategoryNotFoundError`/`PromptNotFoundError` the same way; confirmed against the existing file. |
| R2 | `z.email()` accepts/rejects a borderline address differently than a client expects. | low | low | Format checking is delegated to Zod's built-in email validator (same library already used for `z.uuid()`); acceptable for this scope. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Happy path | `{ name, email, password }`, email unused | `201` + `{ id, name, email, created_at, updated_at }` (no `password`); row persisted with a hashed password | AC1 |
| Missing required field | body without `name` (or `email`/`password`) | `400` E1, `details.body.<field>` reason; nothing persisted | AC2 |
| Empty name | `name: ""` | `400` E1, `details.body.name` reason | AC2 |
| Malformed email | `email: "not-an-email"` | `400` E1, `details.body.email` reason; uniqueness check never runs | AC2 |
| Too-short password | `password` shorter than 8 chars | `400` E1, `details.body.password` reason | AC2 |
| Duplicate email | `email` already used by a seeded user | `422` E2, `{ error: 'EmailAlreadyInUseError', message: 'Email already in use: <email>' }`; no new user stored | AC3 |
| Storage failure | email free but repository `create` throws | `500` E3 generic internal error | AC4 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 name non-empty | §5 V1 — `CreateUserSchema.body.name` (`z.string().min(1)`) |
| V2 email well-formed | §5 V2 — `z.email()` |
| V3 password min 8 | §5 V3 — `z.string().min(8)` |
| V4 email unused | §5 V4 — `RegisterUserUseCase` (existing) |
| E1 validation failed | §3 table — existing `validateRequestMiddleware` + `errorMiddleware` |
| E2 email already in use | §3 table — new `errorMiddleware` 422 branch |
| E3 internal failure | §3 table — existing `errorMiddleware` default branch |
| AC1 create success | §2 handler + route; §8 happy-path row |
| AC2 validation failure | §5 V1–V3; §8 missing/empty/malformed/too-short rows |
| AC3 email already in use | §3 E2; §8 duplicate-email row |
| AC4 internal failure | §3 E3; §8 storage-failure row |
| Fields name/email/password | §3 request contract; §2 schema |
| Returned id/created_at/updated_at | §3 success response (existing use case return, snake_case-mapped in the handler) |
| D6 snake_case wire + boundary mapping | §1 approach; §2 handler; §3 request/response contract |
| D7 email-in-use → 422 | §3 E2 table; §2 `errorMiddleware` branch |
