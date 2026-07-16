# Tasks: Unified boundary error (ApiError)
Plan: specs/20260716102945-api-error/plan.md

- [x] T1. `ApiError` rendered by the central handler (no detail)
  - Type: middleware
  - Depends on: none
  - Red: new test in `tests/integration/middleware/errorMiddleware.test.ts` — a route throws `new ApiError(418, 'STUB_CODE', 'stub message')`; expects status 418 and body strictly equal to `{ status: 418, code: 'STUB_CODE', message: 'stub message' }` (strict `toEqual` proves no `details` key). Fails: `src/errors/ApiError.ts` does not exist.
  - Green: create `src/errors/ApiError.ts` (constructor per plan §3); add the `instanceof ApiError` branch to `src/middleware/errorMiddleware.ts` rendering `{ status, code, message }` only (no `details` handling yet), placed before the `DomainError` branch.
  - Covers: AC4 "Given a controlled boundary failure that carries no additional detail, when it is rendered, then the reply contains the standard shape and no detail property at all — the property is absent, not empty."

- [x] T2. `ApiError` detail included when present
  - Type: middleware
  - Depends on: T1
  - Red: new test in `tests/integration/middleware/errorMiddleware.test.ts` — a route throws `new ApiError(400, 'STUB_CODE', 'stub message', { field: 'bad' })`; expects body strictly equal to `{ status: 400, code: 'STUB_CODE', message: 'stub message', details: { field: 'bad' } }`. Fails: T1's branch ignores `details`.
  - Green: extend the `ApiError` branch with the conditional spread `...(err.details != null && { details: err.details })` (plan §3).
  - Covers: AC5 "Given a controlled boundary failure that carries additional detail, when it is rendered, then the reply includes that detail alongside the standard shape."

- [x] T3. Validation failure raised as `ApiError`
  - Type: middleware
  - Depends on: T2
  - Red: none — behavior-preserving swap; AC1's contract is already pinned by the existing tests `tests/integration/middleware/errorMiddleware.test.ts` ("renders the RequestValidationError contract and never reaches the handler") and `tests/integration/middleware/validateRequest/validateRequestMiddleware.test.ts`, which must stay green **unmodified**.
  - Green: `src/middleware/validateRequest/validateRequestMiddleware.ts` throws `new ApiError(400, 'VALIDATION_ERROR', 'Request Validation data failed', result.errors)`; delete `src/middleware/validateRequest/RequestValidationError.ts`; remove its import and branch from `src/middleware/errorMiddleware.ts`.
  - Covers: AC1 "Given a request whose data fails validation, when it is submitted, then it is rejected with E1 in the standard error shape, including the per-field detail of what failed."; E1

- [x] T4. Rate-limit failure raised as `ApiError`
  - Type: middleware
  - Depends on: T2
  - Red: none — behavior-preserving swap; AC2's contract is already pinned by the existing test `tests/integration/rateLimitMiddleware.test.ts` (drives the real app), which must stay green **unmodified**.
  - Green: `src/middleware/rateLimit/createRateLimitMiddleware.ts` handler forwards `next(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later.'))`; delete `src/middleware/rateLimit/RateLimitExceededError.ts`; remove its import and branch from `src/middleware/errorMiddleware.ts`; update the one test that imports the deleted class (`tests/integration/middleware/errorMiddleware.test.ts`, "renders the RateLimitExceededError contract") to construct the same `ApiError` directly — its envelope assertions stay unchanged.
  - Covers: AC2 "Given a client that has used its full allowance within the current window, when it makes a further request, then it is rejected with E2 in the standard error shape, with no detail property present."; E2

- [ ] T5. Unknown route raised as `ApiError`
  - Type: middleware
  - Depends on: T2
  - Red: none — behavior-preserving swap; AC3's contract is already pinned by the existing not-found test in `tests/integration/app.test.ts` (`{ status: 404, code: 'NOT_FOUND', message: 'Cannot GET /does-not-exist' }`), which must stay green **unmodified**.
  - Green: `src/middleware/notFoundMiddleware.ts` gains `next` and forwards `next(new ApiError(404, 'NOT_FOUND', \`Cannot ${req.method} ${req.path}\`))` instead of rendering the envelope itself; no `app.ts` change (mounting order already `notFoundMiddleware` → `errorMiddleware`).
  - Covers: AC3 "Given a request to a route the service does not expose, when it is made, then it is rejected with E3 in the standard error shape whose message names the attempted action and path, with no detail property present."; E3

- [ ] T6. Document the `ApiError` pattern
  - Type: docs
  - Depends on: T5
  - Red: none — documentation only, no runtime behavior.
  - Green: add a subsection to `.claude/skills/node-express-typescript/SKILL.md` after "Centralized error handler": controlled boundary failures throw one concrete `ApiError(status, code, message, details?)` inline at the point of failure; `details` is passed only for request-validation failures; `ApiError` is for controlled 4xx failures (never 500 — unexpected failures fall through to the generic branch); a code thrown from a second place gets a static factory on `ApiError` instead of a duplicated tuple.
  - Covers: — (documentation; records decisions #1, #3–#5 for future contributors)

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a request whose data fails validation, when it is submitted, then it is rejected with E1 in the standard error shape, including the per-field detail of what failed. | T3 |
| AC2 | Given a client that has used its full allowance within the current window, when it makes a further request, then it is rejected with E2 in the standard error shape, with no detail property present. | T4 |
| AC3 | Given a request to a route the service does not expose, when it is made, then it is rejected with E3 in the standard error shape whose message names the attempted action and path, with no detail property present. | T5 |
| AC4 | Given a controlled boundary failure that carries no additional detail, when it is rendered, then the reply contains the standard shape and no detail property at all — the property is absent, not empty. | T1 |
| AC5 | Given a controlled boundary failure that carries additional detail, when it is rendered, then the reply includes that detail alongside the standard shape. | T2 |
