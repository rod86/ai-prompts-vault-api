# Tasks: Reorganize route schemas and make the health check a first-class resource
Plan: specs/20260717153436-reorganize-route-schemas/plan.md

<!--
This is a behavior-preserving refactor. Most tasks are file moves + import rewires
whose safety net is the EXISTING integration suite staying green — those carry
`Red: none` with the guarding suite named, in the spirit of the logic-less-file
exception (no new behavior is introduced, so no new failing test precedes them).
The one genuinely new behavior to pin is the health resource; T5 and T6 are the
real red→green steps. Order is dependency-first: shared helpers, then each resource
folder, then health, then the docs-layer cleanup, then project-doc updates.
-->

- [ ] T1. Extract shared field validators and error-envelope schemas
  - Type: route schema
  - Depends on: none
  - Red: none — verbatim extraction of validators/schemas that already exist; their behavior (exact validation messages, error/validation envelope shapes) is pinned by the existing endpoint integration tests referenced in AC1. Nothing imports the new files yet, so the tree stays green.
  - Green: create `src/routes/shared/fields.schema.ts` (`uuidField()`, `emailField()` factories carrying today's error-message closures) and `src/routes/shared/error.response.schema.ts` (`ErrorResponseSchema` + `ValidationErrorResponseSchema`, copied from `src/routes/shared.response.schema.ts`).
  - Covers: AC1 "Given the running API, when the full existing test suite for authenticate, register user, list prompt categories, and create/update/delete prompt is run, then every request-validation, success, and error assertion passes unchanged."; V1, V2

- [ ] T2. Move the auth resource into its own folder
  - Type: route handler
  - Depends on: T1
  - Red: none — file move + import rewire; `tests/integration/handlers/auth/authenticateHandler.test.ts` stays green (repointed to the new import paths).
  - Green: create `src/routes/auth/auth.request.schema.ts` (from `auth.schema.ts`, email via `emailField()`), `src/routes/auth/auth.response.schema.ts`, `src/routes/auth/auth.routes.ts`; repoint importers (`src/handlers/auth/authenticateHandler.ts`, `src/routes/index.ts`, `src/docs/auth.ts`, the auth handler test); delete the old flat `src/routes/auth.{schema,response.schema,routes}.ts`.
  - Covers: AC1 "Given the running API, when the full existing test suite for authenticate, register user, list prompt categories, and create/update/delete prompt is run, then every request-validation, success, and error assertion passes unchanged."; V2, V3, E1, E2

- [ ] T3. Move the users resource into its own folder
  - Type: route handler
  - Depends on: T1
  - Red: none — file move + import rewire; `tests/integration/handlers/users/createUserHandler.test.ts` stays green (repointed).
  - Green: create `src/routes/users/users.request.schema.ts` (from `users.schema.ts`, email via `emailField()`), `src/routes/users/users.response.schema.ts`, `src/routes/users/users.routes.ts`; repoint importers (`src/handlers/users/createUserHandler.ts`, `src/routes/index.ts`, `src/docs/users.ts`, the users handler test); delete the old flat `src/routes/users.{schema,response.schema,routes}.ts`.
  - Covers: AC1 "Given the running API, when the full existing test suite for authenticate, register user, list prompt categories, and create/update/delete prompt is run, then every request-validation, success, and error assertion passes unchanged."; V2, V3, E1, E2

- [ ] T4. Move the prompts resource into its own folder and reuse the category schema
  - Type: route handler
  - Depends on: T1
  - Red: none — file move + import rewire; the prompt handler tests (`createPromptHandler`, `updatePromptHandler`, `deletePromptHandler`, `listPromptCategoriesHandler`) stay green (repointed). The `category` field reuse produces the identical wire shape.
  - Green: create `src/routes/prompts/prompts.request.schema.ts` (from `prompts.schema.ts`, ids via `uuidField()`), `src/routes/prompts/prompts.response.schema.ts` (with `category` reusing `PromptCategorySchema`), `src/routes/prompts/prompts.routes.ts`; repoint importers (the four prompt handlers, `src/routes/index.ts`, `src/docs/prompts.ts`, the four prompt handler tests); delete the old flat `src/routes/prompts.{schema,response.schema,routes}.ts`.
  - Covers: AC1 "Given the running API, when the full existing test suite for authenticate, register user, list prompt categories, and create/update/delete prompt is run, then every request-validation, success, and error assertion passes unchanged."; V1, V3, E1, E2

- [ ] T5. Make the health check a first-class resource
  - Type: route handler
  - Depends on: T1
  - Red: add `tests/integration/handlers/health/healthHandler.test.ts` asserting `GET /health` returns `200 { status: 'ok' }` and that `HealthResponseSchema.parse(response.body)` does not throw, importing the schema from `src/routes/health/health.response.schema.js`; fails because that module and the handler/router do not exist yet.
  - Green: create `src/routes/health/health.response.schema.ts` (`HealthResponseSchema` moved out of `shared.response.schema.ts`), `src/handlers/health/healthHandler.ts`, `src/routes/health/health.routes.ts`; mount `healthRouter` first in `src/routes/index.ts`; remove the inline `app.get('/health', …)` from `src/app.ts`; repoint `src/docs/health.ts` to import `HealthResponseSchema` from the health folder; remove the now-duplicated health assertion from `tests/integration/app.test.ts`.
  - Covers: AC2 "Given the running API, when a client requests the health check, then it returns the healthy status body exactly as before."; AC3 "Given the running API, when a client requests the health check, then the response body conforms to the health check's documented response shape."

- [ ] T6. Pin that the health check stays rate-limited
  - Type: route handler
  - Depends on: T5
  - Red: in the health handler test file, add a test that exhausts the global request-rate allowance for a single client identity (unique `X-Forwarded-For`) and asserts the next `/health` request returns the rate-limit response (429 with the uniform error envelope); this guards against `/health` ever being mounted ahead of the global limiter.
  - Green: no production change needed — `/health` is already mounted inside `apiRouter` behind the global limiter (T5); the test passes and locks that placement in.
  - Covers: AC4 "Given a client that has exhausted the general request-rate allowance, when it requests the health check, then it receives the rate-limit response."; E3

- [ ] T7. Deduplicate the documentation response fragments
  - Type: docs
  - Depends on: T2, T3, T4, T5
  - Red: none — `src/docs` is excluded from coverage and declaration-only; the documentation surface is guarded by the existing `tests/integration/docs.test.ts` (the `/openapi.json` document builds and validates) plus every handler test's `<X>ResponseSchema.parse(...)`, all of which stay green.
  - Green: create `src/docs/global.ts` exporting spreadable `unauthorizedResponse` / `rateLimitedResponse` / `validationErrorResponse(description)` fragments; refactor `src/docs/{auth,users,prompts,health}.ts` to use them and to import `ErrorResponseSchema` / `ValidationErrorResponseSchema` from `src/routes/shared/error.response.schema.js`; delete the now-unused `src/routes/shared.response.schema.ts`.
  - Covers: AC5 "Given the running API, when the API documentation document is retrieved, then it still validates and describes the same operations and the same request/response shapes as before."

- [ ] T8. Update project documentation to the new layout
  - Type: docs
  - Depends on: T2, T3, T4, T5, T7
  - Red: none — Markdown only, no runtime surface.
  - Green: update `CLAUDE.md` — the project-structure tree (per-resource `src/routes/<resource>/` folders, `src/routes/shared/`, `src/handlers/health/`, `src/docs/global.ts`) and the `src/app.ts` wiring sentence (health is served by the health router, first in the API router, rather than an inline `app.get`).
  - Covers: (documentation consistency; no AC — no runtime behavior)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given the running API, when the full existing test suite for authenticate, register user, list prompt categories, and create/update/delete prompt is run, then every request-validation, success, and error assertion passes unchanged. | T1, T2, T3, T4 |
| AC2 | Given the running API, when a client requests the health check, then it returns the healthy status body exactly as before. | T5 |
| AC3 | Given the running API, when a client requests the health check, then the response body conforms to the health check's documented response shape. | T5 |
| AC4 | Given a client that has exhausted the general request-rate allowance, when it requests the health check, then it receives the rate-limit response. | T6 |
| AC5 | Given the running API, when the API documentation document is retrieved, then it still validates and describes the same operations and the same request/response shapes as before. | T7 |
