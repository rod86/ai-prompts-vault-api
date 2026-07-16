# Tasks: Interactive API documentation & playground
Plan: specs/20260716171628-api-docs-playground/plan.md

- [x] T1. Install `zod-openapi`
  - Type: dependency
  - Depends on: none
  - Red: none — dependency-change task from plan §6, no test
  - Green: `npm install zod-openapi` (latest stable, prod dependency)
  - Covers: prerequisite for T7–T10

- [x] T2. Authenticate response schema + typed handler
  - Type: response schema
  - Depends on: none
  - Red: in `tests/integration/handlers/auth/authenticateHandler.test.ts`, a new test "response matches the documented shape": authenticate with valid credentials, assert `AuthenticateResponseSchema.parse(response.body)` succeeds — fails because `src/routes/auth.response.schema.ts` does not exist
  - Green: create `src/routes/auth.response.schema.ts` (`AuthenticateResponseSchema` = `{token: string}`, `.meta({id: 'AuthToken'})`); type `authenticateHandler`'s response body as `AuthenticateResponse`
  - Covers: AC5 "Given valid credentials, when a client authenticates, then the response matches the documented authentication success shape exactly."

- [x] T3. User response schema + typed handler
  - Type: response schema
  - Depends on: none
  - Red: in `tests/integration/handlers/users/createUserHandler.test.ts`, a new test "response matches the documented shape": register a user, assert `UserResponseSchema.parse(response.body)` succeeds (`created_at`/`updated_at` as `z.iso.datetime()`) — fails because the schema does not exist
  - Green: create `src/routes/users.response.schema.ts` (`UserResponseSchema`, `.meta({id: 'User'})`); type `createUserHandler`'s response body and map dates via `.toISOString()`
  - Covers: AC6 "Given valid registration data, when a client registers a user, then the response matches the documented registration success shape exactly."

- [x] T4. Prompt response schema + typed create handler
  - Type: response schema
  - Depends on: none
  - Red: in `tests/integration/handlers/prompts/createPromptHandler.test.ts`, a new test "response matches the documented shape": create a prompt, assert `PromptResponseSchema.parse(response.body)` succeeds (nullable `description`, nested `category`/`user`, ISO dates) — fails because `src/routes/prompts.response.schema.ts` does not exist
  - Green: create `src/routes/prompts.response.schema.ts` (`PromptResponseSchema`, `.meta({id: 'Prompt'})`); type `createPromptHandler`'s response body and map dates via `.toISOString()`
  - Covers: AC7 "Given an authenticated user and valid prompt data, when the user creates a prompt, then the response matches the documented prompt shape exactly."

- [x] T5. Typed update-prompt handler
  - Type: response schema
  - Depends on: T4
  - Red: in `tests/integration/handlers/prompts/updatePromptHandler.test.ts`, a new test "response matches the documented shape": update a prompt, assert `PromptResponseSchema.parse(response.body)` succeeds — fails while the handler emits `Date` objects untyped (dates pass JSON-serialized, so the red is the missing typed mapping; if the parse happens to pass, assert the handler's `ResBody` typing via `npm run typecheck` failing before the Green)
  - Green: type `updatePromptHandler`'s response body as `PromptResponse` and map dates via `.toISOString()`
  - Covers: AC8 "Given an authenticated owner and valid prompt data, when the owner updates a prompt, then the response matches the documented prompt shape exactly."

- [x] T6. Category-list response schema + explicit wire mapping
  - Type: response schema
  - Depends on: none
  - Red: in `tests/integration/handlers/prompts/listPromptCategoriesHandler.test.ts`, a new test "response matches the documented shape": list categories, assert `PromptCategoryListResponseSchema.parse(response.body)` succeeds — fails because the schema does not exist
  - Green: add `PromptCategoryListResponseSchema` (array of `{id, name}`, `.meta({id: 'PromptCategory'})` on the item) to `src/routes/prompts.response.schema.ts`; replace `listPromptCategoriesHandler`'s pass-through with an explicit typed `{id, name}` mapping
  - Covers: AC9 "Given existing categories, when a client lists prompt categories, then the response matches the documented category-list shape exactly."

- [x] T7. OpenAPI document skeleton + `GET /openapi.json`
  - Type: docs
  - Depends on: T1
  - Red: new `tests/integration/docs.test.ts`: `GET /openapi.json` returns 200, content type JSON, body with `openapi` starting `3.1`, `info.title = 'AI Prompts Vault API'`, `info.version = '0.1.0'` — fails with 404 (route absent)
  - Green: create `src/docs/api.ts` (`createDocument` with info, `servers: [{url: '/'}]`, `bearerAuth` scheme, tags, empty paths spread); add inline `GET /openapi.json` route in `src/app.ts`
  - Covers: AC1 "Given the service is running, when a client requests the machine-readable API description, then it receives a successful, importable document that declares the description-format version and the service's title and version."

- [ ] T8. Health + auth path entries
  - Type: docs
  - Depends on: T2, T7
  - Red: in `docs.test.ts`, a test asserting the document contains `paths['/health'].get` with exactly responses {200, 429} and `paths['/authenticate'].post` with exactly {200, 400, 401, 429} — fails while `paths` lacks the entries
  - Green: create `src/docs/health.ts` and `src/docs/auth.ts` (reusing `AuthenticateSchema.shape.body`, `AuthenticateResponseSchema`, shared error schemas — creating `src/routes/shared.response.schema.ts` here with `ErrorResponseSchema`/`ValidationErrorResponseSchema`/`HealthResponseSchema`); spread into `api.ts`
  - Covers: AC2 "Given the description document, when its health and authentication entries are inspected, then the health endpoint and the authentication endpoint are present, each listing exactly its real outcomes: health — success and allowance exceeded; authentication — success, invalid input, invalid credentials, and allowance exceeded."

- [ ] T9. Users path entry
  - Type: docs
  - Depends on: T3, T8
  - Red: in `docs.test.ts`, a test asserting `paths['/users'].post` exists with exactly responses {201, 400, 422, 429} — fails while absent
  - Green: create `src/docs/users.ts` (reusing `CreateUserSchema.shape.body`, `UserResponseSchema`, shared error schemas); spread into `api.ts`
  - Covers: AC3 "Given the description document, when its users entry is inspected, then user registration is present, listing exactly its real outcomes: success, invalid input, email already in use, and allowance exceeded."

- [ ] T10. Prompt path entries + security markings
  - Type: docs
  - Depends on: T4, T5, T6, T8
  - Red: in `docs.test.ts`, a test asserting: `paths['/prompt-categories'].get` {200, 429}; `paths['/prompts'].post` {201, 400, 401, 422, 429}; `paths['/prompts/{id}'].put` {200, 400, 401, 403, 404, 422, 429} and `.delete` {204, 400, 401, 403, 404, 429}; `components.securitySchemes.bearerAuth` declared; create/update/delete each carry `security: [{bearerAuth: []}]` — fails while absent
  - Green: create `src/docs/prompts.ts` (reusing the prompts request schemas' `.shape`, `PromptResponseSchema`, `PromptCategoryListResponseSchema`, shared error schemas); spread into `api.ts`
  - Covers: AC4 "Given the description document, when its prompt entries are inspected, then category listing, prompt creation, prompt update, and prompt deletion are all present, each listing exactly its real outcomes (including not-found, not-owner, and unknown-category/user where the endpoint can produce them), the document declares the token-based authentication scheme, and prompt creation, update, and deletion are marked as requiring it."

- [ ] T11. Public static folder + placeholder icon
  - Type: static assets
  - Depends on: none
  - Red: in `docs.test.ts`, a test: `GET /logo.png` returns 200 with content type `image/png` — fails with 404 (no static mount, no file)
  - Green: add `express.static(path.join(process.cwd(), 'public'))` to `src/app.ts`; create `public/logo.png` (generated solid-color 256×256 placeholder)
  - Covers: AC11 "Given a file in the public-files area (the icon), when a client requests its address, then the file is served as-is with its correct content type."

- [ ] T12. Docs HTML page
  - Type: static assets
  - Depends on: T7, T11
  - Red: in `docs.test.ts`, a test: `GET /docs/` returns 200 with content type `text/html`, body containing `/openapi.json` and `/logo.png` — fails with 404 (file absent)
  - Green: create `public/docs/index.html` — Scalar loaded from jsDelivr pinned to the latest stable version, `Scalar.createApiReference('#app', { url: '/openapi.json', favicon: '/logo.png' })`, `<link rel="icon" href="/logo.png">`
  - Covers: AC10 "Given the service is running, when a client requests the documentation page, then it receives a browsable page that loads the description document from its published address and references the service's icon."

- [ ] T13. Rate-limit exemption for the documentation surface
  - Type: route
  - Depends on: T7, T11, T12
  - Red: in `docs.test.ts`, a test (unique `X-Forwarded-For`): responses from `GET /openapi.json` and `GET /docs/` carry no `RateLimit` header, while `GET /health` from the same client does — fails while the docs surface is registered after the global limiter
  - Green: in `src/app.ts`, register the static mount and the `/openapi.json` route **before** `createRateLimitMiddleware(config.rateLimit)`
  - Covers: AC12 "Given the request allowance applies to normal endpoints, when a client requests the documentation page and the description document, then those responses carry no allowance information, while a normal endpoint's response still does."

- [ ] T14. Exclude `src/docs` from coverage
  - Type: tooling
  - Depends on: T7
  - Red: none — config-only change (plan §2, decision #5); no runtime surface
  - Green: add `'src/docs'` to `coverage.exclude` in `vitest.config.ts`; verify `npm test` passes with thresholds intact
  - Covers: decision #5 (tooling; no AC)

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given the service is running, when a client requests the machine-readable API description, then it receives a successful, importable document that declares the description-format version and the service's title and version. | T7 |
| AC2 | Given the description document, when its health and authentication entries are inspected, then the health endpoint and the authentication endpoint are present, each listing exactly its real outcomes: health — success and allowance exceeded; authentication — success, invalid input, invalid credentials, and allowance exceeded. | T8 |
| AC3 | Given the description document, when its users entry is inspected, then user registration is present, listing exactly its real outcomes: success, invalid input, email already in use, and allowance exceeded. | T9 |
| AC4 | Given the description document, when its prompt entries are inspected, then category listing, prompt creation, prompt update, and prompt deletion are all present, each listing exactly its real outcomes (including not-found, not-owner, and unknown-category/user where the endpoint can produce them), the document declares the token-based authentication scheme, and prompt creation, update, and deletion are marked as requiring it. | T10 |
| AC5 | Given valid credentials, when a client authenticates, then the response matches the documented authentication success shape exactly. | T2 |
| AC6 | Given valid registration data, when a client registers a user, then the response matches the documented registration success shape exactly. | T3 |
| AC7 | Given an authenticated user and valid prompt data, when the user creates a prompt, then the response matches the documented prompt shape exactly. | T4 |
| AC8 | Given an authenticated owner and valid prompt data, when the owner updates a prompt, then the response matches the documented prompt shape exactly. | T5 |
| AC9 | Given existing categories, when a client lists prompt categories, then the response matches the documented category-list shape exactly. | T6 |
| AC10 | Given the service is running, when a client requests the documentation page, then it receives a browsable page that loads the description document from its published address and references the service's icon. | T12 |
| AC11 | Given a file in the public-files area (the icon), when a client requests its address, then the file is served as-is with its correct content type. | T11 |
| AC12 | Given the request allowance applies to normal endpoints, when a client requests the documentation page and the description document, then those responses carry no allowance information, while a normal endpoint's response still does. | T13 |
