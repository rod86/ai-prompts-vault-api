# Plan: Authenticate (login and get a token)
Spec: specs/20260714143852-authenticate/spec.md

## 1. Approach
This feature is purely the **HTTP layer** over an already-built use case. The
`LoginUseCase` (`src/modules/auth/application/LoginUseCase.ts`) already looks up the
account by email via `UserCredentialsRepositoryInterface.findByEmail`, throws
`InvalidCredentialsError` when no account matches, compares the submitted password
against the stored hash via the shared `PasswordHasherInterface` (throwing
`InvalidCredentialsError` on mismatch), computes the token expiry from
`DateTimeInterface.now()` + the configured lifetime, issues the token via
`TokenIssuerInterface.issueToken`, and returns `{ token }`. It is already wired as
`loginUseCase` in `src/modules/auth/services.ts` (with `DrizzleUserCredentialsRepository`,
`JwtTokenIssuer`, the shared `passwordHasher`/`dateTimeService`, and
`config.jwtExpirationSeconds`). No domain, application, infrastructure, or migration
work is needed, and it is already unit-tested
(`tests/unit/modules/auth/application/LoginUseCase.test.ts`).

Both `InvalidCredentialsError` failure paths (unknown email, wrong password) throw the
**same** error with the same generic message, so AC3 and AC4 are indistinguishable to
the client "for free" — the handler and middleware treat them identically.

Client-facing field names are **snake_case**, but here all three (`email`, `password`,
`token`) are single-word and map to the use case's `LoginQuery`/`LoginResponse`
unchanged, so no boundary renaming is required (unlike create-user's timestamps).

We add, following the `node-express-typescript` skill and the existing
`createUserHandler` precedent:
1. A request-validation **schema** for the authenticate body, in `src/routes/`, whose
   fields are the snake_case wire names (`email`, `password`), with **full format
   checks** (Decision D3): `email` a well-formed email address, `password` at least 8
   characters — the same validation shape as `CreateUserSchema`.
2. A **handler** (`authenticateHandler`) that reads the validated body from
   `req.parsedRequest`, maps it to the `LoginQuery`, calls `loginUseCase.invoke`, and
   responds `200` with `{ token }`.
3. A new **router** `authRouter` with a route `POST /authenticate`, guarded by
   `validateRequestMiddleware(AuthenticateSchema)`, mounted on the `apiRouter`.
4. An extension of the central `errorMiddleware` to map `InvalidCredentialsError` →
   `401` (E2). Validation (E1) is already handled by the existing middleware.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `AuthenticateSchema` (+ inferred type) | **new** | `src/routes/auth.schema.ts` | Zod schema `{ body: { email (well-formed email), password (min 8 chars) } }` — snake_case wire names, mirroring `CreateUserSchema`; export `AuthenticateRequest = z.infer<...>` for the handler. |
| `authenticateHandler` | **new** | `src/handlers/auth/authenticateHandler.ts` | Reads validated body off `req.parsedRequest`, maps to the `LoginQuery` `{ email, password }`, calls `loginUseCase.invoke`, responds `200` with `{ token: result.token }`. `export default`. |
| `authRouter` | **new** | `src/routes/auth.routes.ts` | `authRouter.post('/authenticate', validateRequestMiddleware(AuthenticateSchema), authenticateHandler)`. |
| `apiRouter` | existing | `src/routes/index.ts` | `apiRouter.use(authRouter)` alongside the existing `promptsRouter`/`usersRouter`. |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Add a branch: `InvalidCredentialsError` → `401 { error: err.name, message: err.message }`, placed alongside the other `401` (token) branches, before the generic `500` fallback. |
| `LoginUseCase` / `loginUseCase` | existing | `.../application/LoginUseCase.ts`, `.../auth/services.ts` | **No change** — reused as-is. |
| `InvalidCredentialsError` | existing | `.../auth/domain/errors/InvalidCredentialsError.ts` | **No change** — imported by `errorMiddleware`. |

`LoginQuery` (the use case input) is `{ email, password }` and `LoginResponse` is
`{ token }` — the validated snake_case body maps to the query directly (both names
single-word, unchanged), and the response passes through unchanged.

## 3. Interfaces & contracts
Request: `POST /authenticate`, JSON body `{ email: string(email), password: string(min 8) }`.

`AuthenticateSchema` (validator contract — `RequestSchema` shape):
```
z.object({
  body: z.object({
    email: z.email({
      error: (issue) =>
        issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid email value',
    }),
    password: z.string({ error: 'Missing required value' }).min(8, 'Must be at least 8 characters'),
  }),
})
```
Handler: reads `req.parsedRequest as AuthenticateRequest`, calls
`loginUseCase.invoke({ email: body.email, password: body.password })`, then
`res.status(200).json({ token: result.token })`.

Success response `200`:
```
{ token }
```
(`password` is never present — it is not on the use case's return shape; no other
fields are returned.)

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `RequestValidationError` (thrown by `validateRequestMiddleware`) | `400 { error: 'RequestValidationError', message: 'Request Validation data failed', details: { body: { <field>: <reason> } } }` — existing behavior. |
| E2 | `InvalidCredentialsError` (thrown by `LoginUseCase` for both unknown-email and wrong-password) | `401 { error: 'InvalidCredentialsError', message: 'Invalid authentication credentials' }` — new `errorMiddleware` branch. Identical for both underlying causes. |

## 4. Data & persistence
None. No schema or migration changes. The read of the account by email uses the
existing `DrizzleUserCredentialsRepository.findByEmail` over the existing user
credentials table, reused unchanged. The endpoint performs no writes.

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `email` required, well-formed email address | `AuthenticateSchema.body.email` (`z.email()`) via `validateRequestMiddleware` | → E1 |
| V2 | `password` required text, min 8 chars | `AuthenticateSchema.body.password` (`z.string().min(8)`) via `validateRequestMiddleware` | → E1 |
| — | account exists for email AND password matches | `LoginUseCase.invoke` (`findByEmail` → `InvalidCredentialsError`; `passwordHasher.compare` → `InvalidCredentialsError`) — existing | → E2 |

## 6. Dependency changes
None. `zod`, `express`, `supertest`, and all middleware/use cases are already present.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks
Assumptions (trivial, decided silently):
1. Route path is `POST /authenticate` on a new `authRouter` (mounted at root, no
   prefix), mirroring how `usersRouter`/`promptsRouter` are mounted. — consequence if
   wrong: path differs; trivial to adjust.
2. The endpoint is public (no auth middleware) — it is the entry point that mints
   tokens, so requiring a token would be nonsensical. — consequence if wrong: n/a.
3. Handler file and exported identifier are named `authenticateHandler` (ending in
   `Handler`, per the project's handler-suffix convention), in a new `src/handlers/auth/`
   directory, mirroring `src/handlers/users/`. — consequence if wrong: a rename.
4. Unknown/extra body properties are stripped by the schema (Zod object default), not
   rejected — mirroring `CreateUserSchema`/`CreatePromptSchema`. — consequence if wrong:
   strict rejection would need `.strict()` and an extra test.
5. The handler consumes the validated body via `req.parsedRequest as AuthenticateRequest`
   (the middleware sets `parsedRequest`, typed `unknown`), mirroring `createUserHandler`;
   no change to the `express.d.ts` typing. — consequence if wrong: a typed accessor is a
   separate concern.
6. `InvalidCredentialsError` maps to `401` (mirroring the existing token-error `401`
   branches), not `403`/`422`. — consequence if wrong: a status-code change in one
   middleware branch.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `errorMiddleware` importing an auth-domain error class couples the HTTP layer to a module's domain. | low | low | The middleware is an unclassified boundaries element — it already imports `MissingTokenError`/`InvalidTokenError`/`TokenExpiredError` from the same module the same way; confirmed against the existing file. |
| R2 | Full format checks (Decision D3) let the input stage reveal the password-length policy and return `400` for a malformed email rather than a uniform `401`. | low | low | Intended behavior (Decision D3), explicitly chosen to match `CreateUserSchema`; the credentials step (unknown email vs. wrong password) remains indistinguishable. |
| R3 | `z.email()` accepts/rejects a borderline address differently than a client expects. | low | low | Format checking is delegated to Zod's built-in email validator, already used by `CreateUserSchema`; acceptable for this scope. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Happy path | `{ email, password }` matching a stored account | `200` + `{ token }` (a non-empty token string; no `password`, no other fields) | AC1 |
| Missing email | body without `email` (valid `password`) | `400` E1, `details.body.email` reason; no token | AC2 |
| Missing password | body without `password` (valid `email`) | `400` E1, `details.body.password` reason; no token | AC2 |
| Empty email/password | `email: ""` or `password: ""` | `400` E1, `details.body.<field>` reason; no token | AC2 |
| Malformed email | `email: "not-an-email"` (valid `password`) | `400` E1, `details.body.email` reason; credentials check never runs | AC2 |
| Too-short password | `password` shorter than 8 chars (valid `email`) | `400` E1, `details.body.password` reason; no token | AC2 |
| Unknown email | well-formed body whose email matches no account | `401` E2, `{ error: 'InvalidCredentialsError', message: 'Invalid authentication credentials' }`; no token | AC3 |
| Wrong password | well-formed body, email matches a seeded account, password wrong | `401` E2, response **identical** to the unknown-email case; no token | AC4 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 email well-formed | §5 V1 — `AuthenticateSchema.body.email` (`z.email()`) |
| V2 password min 8 | §5 V2 — `AuthenticateSchema.body.password` (`z.string().min(8)`) |
| E1 validation failed | §3 table — existing `validateRequestMiddleware` + `errorMiddleware` |
| E2 invalid credentials | §3 table — new `errorMiddleware` 401 branch over `InvalidCredentialsError` |
| AC1 authenticate success | §2 handler + route; §8 happy-path row |
| AC2 validation failure | §5 V1–V2; §8 missing/empty rows |
| AC3 unknown email → invalid credentials | §3 E2; §8 unknown-email row |
| AC4 wrong password → identical invalid credentials | §3 E2 (same error); §8 wrong-password row |
| Fields email/password (submitted) | §3 request contract; §2 schema |
| Returned field token | §3 success response (`LoginResponse.token`, passed through) |
| D1 route/response `POST /authenticate` → `200 { token }` | §1 approach; §2 handler/route; §3 request/response contract |
| D3 full format-check validation (supersedes D2) | §1 approach; §2 schema; §3 request/schema contract; §5 V1/V2; §7 R2/R3; §8 malformed-email & too-short-password rows |
