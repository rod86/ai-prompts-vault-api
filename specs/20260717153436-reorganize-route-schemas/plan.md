# Plan: Reorganize route schemas and make the health check a first-class resource
Spec: specs/20260717153436-reorganize-route-schemas/spec.md

## 1. Approach

Pure structural refactor with **no runtime behavior change**. Three moves:

1. **Per-resource folders under `src/routes/`.** Each resource (`auth`, `prompts`,
   `users`, `health`) gets its own folder holding its router plus its request and
   response schema files. Request-validation files are renamed
   `*.schema.ts` → `*.request.schema.ts` for symmetry with `*.response.schema.ts`.
   Cross-resource pieces move to `src/routes/shared/`:
   `fields.schema.ts` (reusable field validators) and `error.response.schema.ts`
   (the `Error` / `ValidationError` envelopes). Exported symbol names are unchanged;
   only file locations and import paths move.
2. **Deduplicate repeated Zod field validators.** The `z.uuid({...})` closure is
   copy-pasted four times across the prompt request schemas and the `z.email({...})`
   closure twice (auth + users); both collapse into `uuidField()` / `emailField()`
   factories in `src/routes/shared/fields.schema.ts`. `PromptResponseSchema` reuses
   the already-registered `PromptCategorySchema` for its `category` field instead of
   an inline anonymous object (yields a cleaner OpenAPI `$ref`, identical wire shape).
3. **Health becomes a first-class resource.** Extract the inline
   `app.get('/health', …)` in `src/app.ts` into `healthHandler` + `healthRouter`,
   mounted **first inside `apiRouter`** — which is registered after the global rate
   limiter in `app.ts`, so `/health` stays behind that limiter exactly as today. Its
   response schema (`HealthResponseSchema`) moves from `shared.response.schema.ts`
   into `src/routes/health/health.response.schema.ts`, and `src/docs/health.ts`
   imports it from there.

Docs-layer cleanup (implementation-only, output unchanged): a new `src/docs/global.ts`
exports spreadable response fragments (`unauthorizedResponse`, `rateLimitedResponse`,
`validationErrorResponse(...)`), and the four `src/docs/*.ts` paths files use them so
each operation lists only its resource-specific responses.

Existing patterns reused: the router/handler/validate-middleware wiring from
`auth.routes.ts` + `authenticateHandler.ts`; the `RequestHandler<Params, ResBody>`
typing + response-schema-typed body from `listPromptCategoriesHandler.ts`; the
integration-test shape from `authenticateHandler.test.ts` and `app.test.ts`.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Shared field validators | **new** | `src/routes/shared/fields.schema.ts` | `uuidField()`, `emailField()` factories with the current error-message closures |
| Shared error envelopes | **new** (moved) | `src/routes/shared/error.response.schema.ts` | `ErrorResponseSchema` + `ValidationErrorResponseSchema`, moved from `shared.response.schema.ts` |
| Auth request schema | **existing** (moved/renamed) | `src/routes/auth/auth.request.schema.ts` | From `auth.schema.ts`; email uses `emailField()` |
| Auth response schema | **existing** (moved) | `src/routes/auth/auth.response.schema.ts` | From `auth.response.schema.ts`, unchanged content |
| Auth router | **existing** (moved) | `src/routes/auth/auth.routes.ts` | Import path updates only |
| Prompts request schema | **existing** (moved/renamed) | `src/routes/prompts/prompts.request.schema.ts` | From `prompts.schema.ts`; ids use `uuidField()` |
| Prompts response schema | **existing** (moved) | `src/routes/prompts/prompts.response.schema.ts` | From `prompts.response.schema.ts`; `category` reuses `PromptCategorySchema` |
| Prompts router | **existing** (moved) | `src/routes/prompts/prompts.routes.ts` | Import path updates only |
| Users request schema | **existing** (moved/renamed) | `src/routes/users/users.request.schema.ts` | From `users.schema.ts`; email uses `emailField()` |
| Users response schema | **existing** (moved) | `src/routes/users/users.response.schema.ts` | From `users.response.schema.ts`, unchanged content |
| Users router | **existing** (moved) | `src/routes/users/users.routes.ts` | Import path updates only |
| Health response schema | **existing** (moved) | `src/routes/health/health.response.schema.ts` | `HealthResponseSchema` moved out of `shared.response.schema.ts` |
| Health handler | **new** | `src/handlers/health/healthHandler.ts` | Returns `200 { status: 'ok' }`, typed from `HealthResponse` |
| Health router | **new** | `src/routes/health/health.routes.ts` | `GET /health` → `healthHandler` |
| API router | **existing** | `src/routes/index.ts` | Add `healthRouter` first; update auth/prompts/users import paths |
| App bootstrap | **existing** | `src/app.ts` | Remove inline `app.get('/health', …)` |
| Docs — health | **existing** | `src/docs/health.ts` | Import `HealthResponseSchema` from health folder; use `global.ts` fragments |
| Docs — auth/users/prompts | **existing** | `src/docs/{auth,users,prompts}.ts` | Update schema import paths; use `global.ts` fragments |
| Docs — shared fragments | **new** | `src/docs/global.ts` | Spreadable `unauthorizedResponse` / `rateLimitedResponse` / `validationErrorResponse(...)` |
| Old flat files | **existing** | `src/routes/{auth,prompts,users}.{schema,response.schema,routes}.ts`, `src/routes/shared.response.schema.ts` | Deleted after moves |
| Handlers referencing schemas | **existing** | `src/handlers/{auth,prompts,users}/*.ts` | Import path updates only |
| Handler tests referencing schemas | **existing** | `tests/integration/handlers/{auth,prompts,users}/*.test.ts` | Import path updates only |
| Health handler test | **new** | `tests/integration/handlers/health/healthHandler.test.ts` | Health assertions + `HealthResponseSchema.parse(body)` |
| App-level test | **existing** | `tests/integration/app.test.ts` | Remove the health assertion (keeps not-found + error) |
| Project docs | **existing** | `CLAUDE.md` | Update project-structure tree + the `app.ts` health-wiring sentence |

## 3. Interfaces & contracts

New/changed internal signatures (no HTTP contract changes):

- `uuidField(): ZodType` — `z.uuid({ error: (issue) => issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value' })`.
- `emailField(): ZodType` — `z.email({ error: (issue) => issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid email value' })`.
- `HealthResponse = z.infer<typeof HealthResponseSchema>` where `HealthResponseSchema = z.object({ status: z.literal('ok') }).meta({ id: 'Health' })`.
- `healthHandler: RequestHandler<Record<string, string>, HealthResponse>` → `res.status(200).json({ status: 'ok' })`.
- `healthRouter`: `Router()` with `healthRouter.get('/health', healthHandler)`.
- Docs fragments in `global.ts`: `unauthorizedResponse` / `rateLimitedResponse` (const `responses`-entry objects keyed by status) and `validationErrorResponse(description)` returning a `400` entry.

Error mapping — this refactor changes no error, so §4 errors map to their **existing** handling:

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | (request validation) | Existing `ValidationError` envelope with per-field messages — unchanged |
| E2 | Existing `DomainError` subclasses (`NotFound`/`Forbidden`/`Unauthorized`/`Unprocessable`) | Existing `Error` envelope + status via `errorMiddleware` — unchanged |
| E3 | `ApiError(429, 'TOO_MANY_REQUESTS', …)` from the global rate limiter | Existing `Error` envelope + `Retry-After`/`RateLimit-*` headers — unchanged; still applies to `/health` |

## 4. Data & persistence

None. This feature touches no storage, schema, or migration.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Identifier format (+ missing) messages preserved | `uuidField()` in `src/routes/shared/fields.schema.ts`, used by `prompts.request.schema.ts` | → E1 |
| V2 | Email format (+ missing) messages preserved | `emailField()` in `src/routes/shared/fields.schema.ts`, used by `auth`/`users` request schemas | → E1 |
| V3 | All other field validation preserved | Respective `*.request.schema.ts` (content copied verbatim) | → E1 |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. Shared field factories are named `uuidField` / `emailField` and live in `src/routes/shared/fields.schema.ts` — consequence if wrong: a rename, no behavior impact.
2. Docs fragment names are `unauthorizedResponse` / `rateLimitedResponse` / `validationErrorResponse` in `src/docs/global.ts` — consequence if wrong: a rename, no output impact.
3. `healthRouter` is mounted first in `src/routes/index.ts`; ordering among sibling routers is irrelevant (distinct paths) — consequence if wrong: none observable.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A moved import path is missed, breaking compilation | med | build fails | `npm run typecheck` + `npm run lint` gate every move |
| R2 | Health accidentally mounted outside the rate limiter, weakening the DoS guard | low | health no longer rate-limited | Mount in `apiRouter` (already after the limiter in `app.ts`); AC4 test asserts the 429 |
| R3 | `PromptCategorySchema` reuse alters the OpenAPI output shape | low | docs drift | AC5 asserts the document still builds/validates; wire shape is identical |
| R4 | `eslint-plugin-boundaries` rejects the new nesting | low | lint fails | Config scopes elements to `src/modules/**` only; `src/routes/**` is unaffected — confirmed |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Health under rate limit | Client exceeded global allowance, requests `/health` | Rate-limit response returned | AC4 |
| Health body shape | Normal `/health` request | Body validates against `HealthResponseSchema` | AC3 |
| Missing vs invalid id | Prompt request with absent vs malformed id | "Missing required value" vs "Invalid UUID value" respectively | AC1 (V1) |
| Missing vs invalid email | Auth/user request with absent vs malformed email | "Missing required value" vs "Invalid email value" respectively | AC1 (V2) |
| Docs document builds | Retrieve the API documentation document | Same operations + request/response shapes as before | AC5 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| §2 health `status` field | `HealthResponseSchema` (§3), health response schema move (§2 components) |
| V1 | `uuidField()` (§2, §3, §5) |
| V2 | `emailField()` (§2, §3, §5) |
| V3 | `*.request.schema.ts` verbatim copies (§2, §5) |
| E1 | Existing validation middleware (§3 error map) |
| E2 | Existing `errorMiddleware`/`DomainError` (§3 error map) |
| E3 | Global rate limiter still applied to `/health` via `apiRouter` mount (§1, §3, R2) |
| AC1 | Renamed request schemas + moved response schemas + handler/router import updates (§2) |
| AC2 | `healthHandler` + `healthRouter` (§2, §3) |
| AC3 | `HealthResponseSchema` move + health handler test parse assertion (§2, §8) |
| AC4 | Health mounted behind the global limiter (§1, R2, §8) |
| AC5 | Docs import-path updates + `global.ts` fragments; unchanged OpenAPI output (§2, R3, §8) |
