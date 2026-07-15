# Tasks: Uniform Error Envelope + Domain Error Classification
Plan: specs/20260715172739-ddd-error-envelope/plan.md

Test-first, dependency-first. The migration is incremental: the generic `DomainError`
branch is added to the middleware **after** the existing per-class branches (T5), so
un-migrated errors keep hitting their old branch and stay green. Each re-parent task
(T7–T14) then re-parents one error class **and removes its now-superseded per-class
branch**, so the error falls through to the generic branch — that removal is what turns
its assertion red→green, leaving no dead code behind.

- [ ] T1. `DomainError` base + `ErrorCategory`
  - Type: domain
  - Depends on: none
  - Red: unit test `tests/unit/modules/shared/domain/DomainError.test.ts` — a throwaway
    subclass with `code='X'`, `category='NotFound'` asserts: `err.name` equals the
    subclass name, `err.message` is the passed message, a forwarded `cause` is preserved,
    and `code`/`category` are readable. Fails: file does not exist.
  - Green: `src/modules/shared/domain/DomainError.ts` — `export type ErrorCategory` +
    abstract `DomainError extends Error` (abstract `code`/`category`, protected ctor sets
    `name = new.target.name`, forwards `options.cause`).
  - Covers: prerequisite for AC1–AC8; unit-verifies the `name`/`cause`/`code`/`category` contract.

- [ ] T2. `CATEGORY_STATUS` map
  - Type: route handler (HTTP mapping)
  - Depends on: T1
  - Red: unit test `tests/unit/middleware/domainErrorStatus.test.ts` — asserts
    `NotFound→404`, `Forbidden→403`, `Unauthorized→401`, `Unprocessable→422`. Fails: file
    does not exist.
  - Green: `src/middleware/domainErrorStatus.ts` — `CATEGORY_STATUS` object
    `satisfies Record<ErrorCategory, number>`.
  - Covers: prerequisite for AC1–AC8; the family→status resolution.

- [ ] T3. Validation branch → uniform envelope
  - Type: middleware
  - Depends on: none
  - Red: update `tests/integration/middleware/errorMiddleware.test.ts` validation case to
    expect `{ status:400, code:'VALIDATION_ERROR', message:'Request Validation data failed', details: { body: { name: 'name invalid' } } }`. Fails: current body is `{ error, message, details }`.
  - Green: `src/middleware/errorMiddleware.ts` — change the `RequestValidationError`
    branch body to `{ status:400, code:'VALIDATION_ERROR', message: err.message, details: err.details }`.
  - Covers: AC9 "Given request input that violates a field rule, When it is submitted, Then the response is an invalid-request outcome with `code` `VALIDATION_ERROR` and a `details` object (existing nested shape), and body `status` equals the transport status."; E9, V1

- [ ] T4. Generic fallback → uniform envelope + log cause
  - Type: middleware
  - Depends on: none
  - Red: update `tests/integration/middleware/errorMiddleware.test.ts` internal-error case
    to expect `{ status:500, code:'INTERNAL_ERROR', message:'Internal server error' }` and
    assert `console.error` was called with the thrown error (spy). Fails: current body is
    `{ error:'InternalServerError', message }` and nothing is logged.
  - Green: `src/middleware/errorMiddleware.ts` — final branch logs `console.error(err)`
    then returns the generic envelope.
  - Covers: AC11 "Given an unexpected/technical failure, When it occurs during a request, Then the response is a generic internal-failure outcome with `code` `INTERNAL_ERROR` and a fixed message, no internal detail is leaked, and the underlying cause is recorded server-side."; E11, V3

- [ ] T5. Generic `DomainError` branch (added after per-class branches)
  - Type: middleware
  - Depends on: T1, T2
  - Red: add an `it` to `tests/integration/middleware/errorMiddleware.test.ts` that throws
    a local stub subclass of `DomainError` (`code='STUB'`, `category='Unprocessable'`) and
    expects `{ status:422, code:'STUB', message:<msg> }`. Fails: no branch handles it → 500.
  - Green: `src/middleware/errorMiddleware.ts` — insert `else if (err instanceof DomainError)`
    branch (importing only `DomainError` + `CATEGORY_STATUS`) **below the existing
    per-class branches, above the fallback**: `const status = CATEGORY_STATUS[err.category]; res.status(status).json({ status, code: err.code, message: err.message })`.
  - Covers: prerequisite/mechanism for AC1–AC8 (generic domain rendering via the category map).

- [ ] T6. `notFoundMiddleware` → uniform envelope
  - Type: middleware
  - Depends on: none
  - Red: update `tests/integration/app.test.ts` unknown-route case to expect
    `{ status:404, code:'NOT_FOUND', message:'Cannot GET /does-not-exist' }`. Fails: current
    body is `{ error:'NotFound', message }`.
  - Green: `src/middleware/notFoundMiddleware.ts` — return
    `{ status:404, code:'NOT_FOUND', message: \`Cannot ${req.method} ${req.path}\` }`.
  - Covers: AC10 "Given a path the API does not serve, When a client requests it, Then the response is a not-found outcome with `code` `NOT_FOUND` and a message naming the method and path."; E10

- [ ] T7. Migrate `PromptNotFoundError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update `PromptNotFoundError` assertions in
    `tests/integration/handlers/prompts/deletePromptHandler.test.ts` and
    `tests/integration/handlers/prompts/updatePromptHandler.test.ts` to
    `{ status:404, code:'PROMPT_NOT_FOUND', message:<msg> }`. Fails: old per-class branch still returns `{ error, message }`.
  - Green: re-parent `src/modules/prompt/domain/errors/PromptNotFoundError.ts` to
    `DomainError` (`code='PROMPT_NOT_FOUND'`, `category='NotFound'`, drop `this.name`) and
    remove its per-class branch + import from `errorMiddleware.ts`.
  - Covers: AC1 "Given a prompt id that does not exist, When a client requests an operation on it, Then the response is a not-found outcome with `code` `PROMPT_NOT_FOUND`, a message, and a body `status` equal to the transport status."; E1, V2

- [ ] T8. Migrate `PromptOwnershipError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update `PromptOwnershipError` assertions in
    `tests/integration/handlers/prompts/deletePromptHandler.test.ts` and
    `tests/integration/handlers/prompts/updatePromptHandler.test.ts` to
    `{ status:403, code:'PROMPT_OWNERSHIP', message:<msg> }`. Fails: old branch shape.
  - Green: re-parent `src/modules/prompt/domain/errors/PromptOwnershipError.ts`
    (`code='PROMPT_OWNERSHIP'`, `category='Forbidden'`) and remove its per-class branch + import.
  - Covers: AC2 "Given a prompt owned by another user, When a client attempts to modify or delete it, Then the response is a forbidden outcome with `code` `PROMPT_OWNERSHIP`."; E2

- [ ] T9. Migrate `CategoryNotFoundError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update `CategoryNotFoundError` assertions in
    `tests/integration/handlers/prompts/createPromptHandler.test.ts` and
    `tests/integration/handlers/prompts/updatePromptHandler.test.ts` to
    `{ status:422, code:'CATEGORY_NOT_FOUND', message:<msg> }`. Fails: old branch shape.
  - Green: re-parent `src/modules/prompt/domain/errors/CategoryNotFoundError.ts`
    (`code='CATEGORY_NOT_FOUND'`, `category='Unprocessable'`) and remove its per-class branch + import.
  - Covers: AC3 "Given a category id that does not exist, When a client creates or updates a prompt referencing it, Then the response is an unprocessable outcome with `code` `CATEGORY_NOT_FOUND`."; E3

- [ ] T10. Migrate `EmailAlreadyInUseError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update `EmailAlreadyInUseError` assertion in
    `tests/integration/handlers/users/createUserHandler.test.ts` to
    `{ status:422, code:'EMAIL_ALREADY_IN_USE', message:<msg> }`. Fails: old branch shape.
  - Green: re-parent `src/modules/user/domain/errors/EmailAlreadyInUseError.ts`
    (`code='EMAIL_ALREADY_IN_USE'`, `category='Unprocessable'`) and remove its per-class branch + import.
  - Covers: AC4 "Given an email already registered, When a client registers with it, Then the response is an unprocessable outcome with `code` `EMAIL_ALREADY_IN_USE`."; E4

- [ ] T11. Migrate `InvalidCredentialsError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update both `InvalidCredentialsError` assertions in
    `tests/integration/handlers/auth/authenticateHandler.test.ts` to
    `{ status:401, code:'INVALID_CREDENTIALS', message:<msg> }`. Fails: old branch shape.
  - Green: re-parent `src/modules/auth/domain/errors/InvalidCredentialsError.ts`
    (`code='INVALID_CREDENTIALS'`, `category='Unauthorized'`) and remove its per-class branch + import.
  - Covers: AC5 "Given invalid credentials, When a client authenticates, Then the response is an unauthorized outcome with `code` `INVALID_CREDENTIALS`."; E5

- [ ] T12. Migrate `MissingTokenError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update the `MissingTokenError` assertion in
    `tests/integration/middleware/requireAuthMiddleware.test.ts` to include
    `code:'MISSING_TOKEN'` (and `status:401`). Fails: old branch omits `code`.
  - Green: re-parent `src/modules/auth/domain/errors/MissingTokenError.ts`
    (`code='MISSING_TOKEN'`, `category='Unauthorized'`) and remove its per-class branch + import.
  - Covers: AC6 "Given no token, When a client calls a protected route, Then the response is an unauthorized outcome with `code` `MISSING_TOKEN`."; E6

- [ ] T13. Migrate `InvalidTokenError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update the two `InvalidTokenError` assertions in
    `tests/integration/middleware/requireAuthMiddleware.test.ts` to include
    `code:'INVALID_TOKEN'` (and `status:401`). Fails: old branch omits `code`.
  - Green: re-parent `src/modules/auth/domain/errors/InvalidTokenError.ts`
    (`code='INVALID_TOKEN'`, `category='Unauthorized'`) and remove its per-class branch + import.
  - Covers: AC7 "Given an invalid token, When a client calls a protected route, Then the response is an unauthorized outcome with `code` `INVALID_TOKEN`."; E7

- [ ] T14. Migrate `TokenExpiredError`
  - Type: domain
  - Depends on: T1, T5
  - Red: update the `TokenExpiredError` assertion in
    `tests/integration/middleware/requireAuthMiddleware.test.ts` to include
    `code:'TOKEN_EXPIRED'` (and `status:401`). Fails: old branch omits `code`.
  - Green: re-parent `src/modules/auth/domain/errors/TokenExpiredError.ts`
    (`code='TOKEN_EXPIRED'`, `category='Unauthorized'`) and remove its per-class branch +
    import. After this task `errorMiddleware.ts` imports only `DomainError`,
    `RequestValidationError`, and `CATEGORY_STATUS` (no module error classes) — confirm
    `npm run lint` passes.
  - Covers: AC8 "Given an expired token, When a client calls a protected route, Then the response is an unauthorized outcome with `code` `TOKEN_EXPIRED`."; E8

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a prompt id that does not exist, When a client requests an operation on it, Then the response is a not-found outcome with `code` `PROMPT_NOT_FOUND`, a message, and a body `status` equal to the transport status. | T7 (via T1, T5) |
| AC2 | Given a prompt owned by another user, When a client attempts to modify or delete it, Then the response is a forbidden outcome with `code` `PROMPT_OWNERSHIP`. | T8 (via T1, T5) |
| AC3 | Given a category id that does not exist, When a client creates or updates a prompt referencing it, Then the response is an unprocessable outcome with `code` `CATEGORY_NOT_FOUND`. | T9 (via T1, T5) |
| AC4 | Given an email already registered, When a client registers with it, Then the response is an unprocessable outcome with `code` `EMAIL_ALREADY_IN_USE`. | T10 (via T1, T5) |
| AC5 | Given invalid credentials, When a client authenticates, Then the response is an unauthorized outcome with `code` `INVALID_CREDENTIALS`. | T11 (via T1, T5) |
| AC6 | Given no token, When a client calls a protected route, Then the response is an unauthorized outcome with `code` `MISSING_TOKEN`. | T12 (via T1, T5) |
| AC7 | Given an invalid token, When a client calls a protected route, Then the response is an unauthorized outcome with `code` `INVALID_TOKEN`. | T13 (via T1, T5) |
| AC8 | Given an expired token, When a client calls a protected route, Then the response is an unauthorized outcome with `code` `TOKEN_EXPIRED`. | T14 (via T1, T5) |
| AC9 | Given request input that violates a field rule, When it is submitted, Then the response is an invalid-request outcome with `code` `VALIDATION_ERROR` and a `details` object (existing nested shape), and body `status` equals the transport status. | T3 |
| AC10 | Given a path the API does not serve, When a client requests it, Then the response is a not-found outcome with `code` `NOT_FOUND` and a message naming the method and path. | T6 |
| AC11 | Given an unexpected/technical failure, When it occurs during a request, Then the response is a generic internal-failure outcome with `code` `INTERNAL_ERROR` and a fixed message, no internal detail is leaked, and the underlying cause is recorded server-side. | T4 |
