# Plan: Interactive API documentation & playground
Spec: specs/20260716171628-api-docs-playground/spec.md

## 1. Approach

Generate an OpenAPI 3.1 document at boot with `zod-openapi`'s `createDocument`,
fed by the **existing request schemas** (`src/routes/*.schema.ts`) and **new
response schemas** (`src/routes/*.response.schema.ts`). The document is a
module-level constant assembled in a new `src/docs/` folder (one composition
root `api.ts` + one paths file per functional area) and served by a new
`GET /openapi.json` route in `src/app.ts`. The interactive UI is a static
HTML page (`public/docs/index.html`) rendering that document with **Scalar**
loaded from the jsDelivr CDN (pinned version); a new `express.static` mount
serves the whole `public/` folder as-is. Both the static mount and the
`/openapi.json` route are registered **before** the global rate limiter in
`app.ts`, exempting the documentation surface (AC12). Response truthfulness
(AC5–AC9) comes from typing each handler's `res` body with the response
schema's inferred type plus a `.parse()` assertion in the existing handler
integration tests — no runtime parsing in production.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Shared response schemas | new | `src/routes/shared.response.schema.ts` | `ErrorResponseSchema` (`{status, code, message}`), `ValidationErrorResponseSchema` (extends it with `details` matching `ValidationDetails` from `src/middleware/validateRequest/validator.ts`), `HealthResponseSchema` (`{status: 'ok'}`) |
| Auth response schema | new | `src/routes/auth.response.schema.ts` | `AuthenticateResponseSchema` (`{token}`) |
| Users response schema | new | `src/routes/users.response.schema.ts` | `UserResponseSchema` (`{id, name, email, created_at, updated_at}`) |
| Prompts response schemas | new | `src/routes/prompts.response.schema.ts` | `PromptResponseSchema` (`{id, title, prompt, description (nullable), category {id,name}, user {id,name}, created_at, updated_at}`), `PromptCategoryListResponseSchema` (array of `{id, name}`) |
| Docs composition root | new | `src/docs/api.ts` | `createDocument({...})`: info (title `AI Prompts Vault API`, version `0.1.0`), `servers: [{url: '/'}]`, `bearerAuth` security scheme, tags, spread of area paths; exports `openApiDocument` |
| Health paths | new | `src/docs/health.ts` | `GET /health` entry: 200 (`HealthResponseSchema`), 429 |
| Auth paths | new | `src/docs/auth.ts` | `POST /authenticate`: 200, 400 (validation), 401 (`InvalidCredentialsError`), 429 |
| Users paths | new | `src/docs/users.ts` | `POST /users`: 201, 400, 422 (`EmailAlreadyInUseError`), 429 |
| Prompts paths | new | `src/docs/prompts.ts` | `GET /prompt-categories`: 200, 429. `POST /prompts`: 201, 400, 401, 422 (`CategoryNotFoundError`/`UserNotFoundError`), 429. `PUT /prompts/{id}`: 200, 400, 401, 403, 404, 422 (`CategoryNotFoundError`), 429. `DELETE /prompts/{id}`: 204, 400, 401, 403, 404, 429. Create/update/delete carry `security: [{bearerAuth: []}]` |
| App wiring | existing | `src/app.ts` | Before the global limiter: `express.static` on `public/` and `GET /openapi.json` returning `openApiDocument` (mirrors the inline `/health` route pattern) |
| Docs HTML page | new | `public/docs/index.html` | Scalar via pinned jsDelivr script; `Scalar.createApiReference('#app', { url: '/openapi.json' })`; `<link rel="icon" href="/logo.png">` and Scalar `favicon` option |
| Icon placeholder | new | `public/logo.png` | Dummy 256×256 PNG, replaced later by file swap |
| Authenticate handler | existing | `src/handlers/auth/authenticateHandler.ts` | Type response body as `AuthenticateResponse` |
| Create-user handler | existing | `src/handlers/users/createUserHandler.ts` | Type response body as `UserResponse`; map dates via `.toISOString()` |
| Create-prompt handler | existing | `src/handlers/prompts/createPromptHandler.ts` | Type response body as `PromptResponse`; map dates via `.toISOString()` |
| Update-prompt handler | existing | `src/handlers/prompts/updatePromptHandler.ts` | Same as create-prompt handler |
| List-categories handler | existing | `src/handlers/prompts/listPromptCategoriesHandler.ts` | Replace pass-through with explicit wire mapping to `{id, name}[]`, typed as `PromptCategoryListResponse` |
| Coverage config | existing | `vitest.config.ts` | Add `'src/docs'` to `coverage.exclude` (decision #5) |
| Docs integration tests | new | `tests/integration/docs.test.ts` | Tests for `/openapi.json` content, `/docs/` page, `/logo.png`, rate-limit exemption |
| Handler tests | existing | `tests/integration/handlers/**/*.test.ts` | Add one response-schema `.parse()` assertion per success-shape AC |

## 3. Interfaces & contracts

- `openApiDocument: ZodOpenApiObject` output — plain object, serialized by
  `res.json()`; content type `application/json` (AC1 importability).
- Response schemas use Zod 4 native `.meta({ id: '<Name>' })` so `zod-openapi`
  hoists them into `components/schemas` (`Prompt`, `User`, `AuthToken`,
  `PromptCategory`, `Error`, `ValidationError`, `Health`).
- Dates on the wire: `z.iso.datetime()` (string). Handlers therefore map
  `Date → .toISOString()` explicitly — the serialized output is byte-identical
  to today's `res.json(Date)` behavior (JSON serialization already emits ISO
  strings), so the wire contract is unchanged.
- Handler typing: `RequestHandler<P, ResBody>` with `ResBody = z.infer<typeof
  <X>ResponseSchema>`; `deletePromptHandler` is untouched (204, no body).
- Request sides of every operation reuse the existing schemas via `.shape`
  access (e.g. `CreatePromptSchema.shape.body`,
  `UpdatePromptSchema.shape.params`) — the validation schemas themselves are
  not modified.

Errors: spec §4 defines no new errors, so there is no E# mapping. The
document *describes* existing error responses using `ErrorResponseSchema` /
`ValidationErrorResponseSchema` against the statuses produced by
`errorMiddleware` (`CATEGORY_STATUS`: 401/403/404/422), the validation
middleware (400 `VALIDATION_ERROR`), and the rate limiters (429).

## 4. Data & persistence

None.

## 5. Validation

None — spec §3 has no rules (no new client-supplied fields).

## 6. Dependency changes

| Dependency | Version | Action | Reason |
|--|--|--|--|
| `zod-openapi` | latest stable at install time | install (prod) | Generate the OpenAPI 3.1 document from the existing Zod schemas |

The Scalar renderer is **not** an npm dependency — it loads in the browser
from jsDelivr, pinned to the latest stable version at implementation time
(decision #1).

## 7. Assumptions & risks

Assumptions:
1. `GET /openapi.json` is an inline route in `app.ts` (mirroring the existing
   inline `/health` route) rather than a router+handler pair — consequence if
   wrong: move ~4 lines into `src/handlers/`.
2. `info.version` is hardcoded to `0.1.0` (matches `package.json` today) —
   consequence if wrong: one-line drift fixed on version bumps.
3. Health gets its own `src/docs/health.ts` paths file — consequence if
   wrong: fold the entry into `api.ts`.
4. No `eslint-plugin-boundaries` change is needed: `.eslintrc.json` defines
   elements only under `src/modules/*` with `boundaries/no-unknown` off, so
   `src/docs/` (like `src/handlers/`) is unconstrained — consequence if
   wrong: add an element entry for `src/docs`.
5. The dummy `public/logo.png` is a generated solid-color 256×256 PNG —
   consequence if wrong: none; it's replaced by the user regardless.
6. The generic 500 `INTERNAL_ERROR` fallback is **not** documented per
   endpoint (decision #11 scopes documentation to outcomes endpoints
   deliberately produce) — consequence if wrong: add a shared 500 entry.
7. New doc tests live in `tests/integration/docs.test.ts` (keeping
   `app.test.ts` for existing app-level concerns) — consequence if wrong:
   relocate the file.
8. `servers: [{url: '/'}]` (relative) so the playground targets whatever
   origin serves the page — consequence if wrong: add an env-configured
   absolute URL.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Scalar CDN unreachable for a viewer → docs page blank | low | docs UI unavailable (API + `/openapi.json` unaffected) | Pinned version on jsDelivr (multi-CDN); acceptable for a demo deployment |
| R2 | `zod-openapi` mis-renders a schema construct (e.g. custom error maps) | low | wrong doc fragment | Boot-time `createDocument` throws on invalid input; AC2–AC4 tests pin the rendered entries |
| R3 | Excluding `src/docs` shifts global coverage percentages | low | thresholds (80%) behave differently | Exclusion removes near-100% trivial lines only; thresholds still apply to real code |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| `/docs` without trailing slash | `GET /docs` | `express.static` redirects to `/docs/`, which serves the page | AC10 |
| Missing file near docs | `GET /docs/nope.js` | Falls through the static mount into the limited zone → standard 404 envelope, allowance consumed | spec §4 (unchanged errors) |
| Prompt without description | create/update with no `description` | Response has `description: null`; schema declares it nullable | AC7, AC8 |
| Playground calls a real endpoint | "try it" on `POST /prompts` | Counts against the caller's allowance like any client | AC12 (inverse assertion) |
| Date fields | any success body with timestamps | ISO-8601 UTC strings, identical to current serialization | AC5–AC8 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| AC1 | `src/docs/api.ts`, `GET /openapi.json` in `app.ts` |
| AC2 | `src/docs/health.ts`, `src/docs/auth.ts` |
| AC3 | `src/docs/users.ts` |
| AC4 | `src/docs/prompts.ts`, `bearerAuth` in `api.ts` |
| AC5 | `auth.response.schema.ts`, `authenticateHandler.ts` typing + test assertion |
| AC6 | `users.response.schema.ts`, `createUserHandler.ts` |
| AC7 | `prompts.response.schema.ts`, `createPromptHandler.ts` |
| AC8 | `prompts.response.schema.ts`, `updatePromptHandler.ts` |
| AC9 | `prompts.response.schema.ts`, `listPromptCategoriesHandler.ts` explicit mapping |
| AC10 | `public/docs/index.html` |
| AC11 | `express.static('public')` mount, `public/logo.png` |
| AC12 | Mount order in `app.ts` (docs surface above the global limiter) |
| field: service title/version | `info` in `src/docs/api.ts` |
| field: icon | `public/logo.png` + references in `index.html` |
