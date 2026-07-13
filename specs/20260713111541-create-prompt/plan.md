# Plan: Create prompt
Spec: specs/20260713111541-create-prompt/spec.md

## 1. Approach
This feature is purely the **HTTP layer** over an already-built use case. The
`CreatePromptUseCase` (`src/modules/prompt/application/CreatePromptUseCase.ts`) already
generates the id + timestamps, checks category existence (throwing
`CategoryNotFoundError`), persists via `DrizzlePromptRepository.create`, wraps storage
failures in `PromptCreationError`, and returns a full `Prompt` (with expanded category).
It is already wired as `createPromptUseCase` in `src/modules/prompt/services.ts`. No
domain, application, infrastructure, or migration work is needed.

Client-facing field names are **snake_case** (spec D7), while the domain use case is
camelCase (`CreatePromptQuery.categoryId`; `Prompt.createdAt`/`updatedAt`). The handler
therefore **maps at the HTTP boundary** — `category_id → categoryId` on the way in, and
`createdAt/updatedAt → created_at/updated_at` on the way out — rather than passing the
body/prompt through one-to-one. The mapping is done **inline in the handler** (D7); no
serializer module (kept minimal for a single endpoint).

We add, following the `node-express-typescript` skill and the existing
`listPromptCategoriesHandler` precedent:
1. A request-validation **schema** for the create body, in `src/routes/`, whose fields
   are the snake_case wire names (`category_id`, …).
2. A **handler** (`createPromptHandler`) that reads the validated snake_case body from
   `req.parsedRequest`, maps it to the camelCase `CreatePromptQuery`, calls
   `createPromptUseCase.invoke`, and responds `201` with the returned prompt mapped to
   the snake_case response shape.
3. A **route** `POST /prompts` on the existing `promptsRouter`, guarded by
   `validateRequestMiddleware(CreatePromptSchema)`.
4. An extension of the central `errorMiddleware` to map `CategoryNotFoundError` → `422`
   (E2). Validation (E1) and generic-internal (E3) are already handled by the existing
   middleware; this is the app's first domain-error → HTTP mapping.

This is the first route to use `validateRequestMiddleware`, so it establishes the
schema-per-route + `req.parsedRequest` consumption pattern for the project, and the
first to establish the snake_case-wire ⇄ camelCase-domain boundary-mapping convention.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `CreatePromptSchema` (+ inferred type) | **new** | `src/routes/prompts.schema.ts` | Zod schema `{ body: { title, prompt, category_id (uuid), description? } }` — snake_case wire names; export `CreatePromptRequest = z.infer<...>` for the handler. |
| `createPromptHandler` | **new** | `src/handlers/prompts/createPromptHandler.ts` | Reads validated snake_case body off `req.parsedRequest`, maps `category_id → categoryId` into the `CreatePromptQuery`, calls `createPromptUseCase.invoke`, maps the returned `Prompt` to the snake_case response (`created_at`/`updated_at`), responds `201`. `export default`. |
| `promptsRouter` | existing | `src/routes/prompts.routes.ts` | Add `promptsRouter.post('/prompts', validateRequestMiddleware(CreatePromptSchema), createPromptHandler)`. |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Add a branch: `CategoryNotFoundError` → `422 { error: err.name, message: err.message }`. |
| `CreatePromptUseCase` / `createPromptUseCase` | existing | `.../application/CreatePromptUseCase.ts`, `.../prompt/services.ts` | **No change** — reused as-is. |
| `CategoryNotFoundError` | existing | `.../prompt/domain/errors/CategoryNotFoundError.ts` | **No change** — imported by `errorMiddleware`. |

`CreatePromptQuery` (the use case input) is `{ title, prompt, categoryId, description? }` —
the validated snake_case body maps to it by renaming `category_id → categoryId` (the
other fields are single-word and pass through unchanged).

## 3. Interfaces & contracts
Request: `POST /prompts`, JSON body `{ title: string, prompt: string, category_id: string(uuid), description?: string }`.

`CreatePromptSchema` (validator contract — `RequestSchema` shape):
```
z.object({
  body: z.object({
    title: z.string(),
    prompt: z.string(),
    category_id: z.string().uuid(),
    description: z.string().optional(),
  }),
})
```
Handler: reads `req.parsedRequest as CreatePromptRequest`, maps to the camelCase query
`{ title, prompt, categoryId: body.category_id, description }`, calls
`createPromptUseCase.invoke(query)`, then maps the returned `Prompt` to the snake_case
response and `res.status(201).json(response)`.

Success response `201`:
```
{ id, title, prompt, description?, category: { id, name }, created_at, updated_at }
```
(`description` present only when submitted — preserved through the mapping; `created_at`/
`updated_at` are the camelCase `createdAt`/`updatedAt` renamed, serialized as ISO strings
by `res.json`. The nested `category` `{ id, name }` keys are single-word, unchanged.)

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `RequestValidationError` (thrown by `validateRequestMiddleware`) | `400 { error: 'RequestValidationError', message: 'Request Validation data failed', details: { body: { <field>: <reason> } } }` — existing behavior. |
| E2 | `CategoryNotFoundError` (thrown by `CreatePromptUseCase`) | `422 { error: 'CategoryNotFoundError', message: 'Category not found: <id>' }` — new `errorMiddleware` branch. |
| E3 | `PromptCreationError` / any other error | `500 { error: 'InternalServerError', message: 'Internal server error' }` — existing default branch. |

## 4. Data & persistence
None. No schema or migration changes. Persistence is the existing `prompts` table via
`DrizzlePromptRepository.create`, reused unchanged (`id` app-provided; `promptCategoryId`,
`title`, `prompt`, `description` (null when absent), `createdAt`, `updatedAt`).

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `title` required text | `CreatePromptSchema.body.title` (`z.string()`) via `validateRequestMiddleware` | → E1 |
| V2 | `prompt` required text | `CreatePromptSchema.body.prompt` (`z.string()`) | → E1 |
| V3 | `category_id` required, well-formed identifier | `CreatePromptSchema.body.category_id` (`z.string().uuid()`) | → E1 |
| V4 | `description` optional text | `CreatePromptSchema.body.description` (`z.string().optional()`) | → E1 |
| V5 | referenced category must exist | `CreatePromptUseCase.invoke` (`categoryRepository.findById` → `CategoryNotFoundError`) — existing | → E2 |

## 6. Dependency changes
None. `zod`, `express`, `supertest`, and all middleware/use cases are already present.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks
Assumptions (trivial, decided silently):
1. Route path is `POST /prompts` on the existing `promptsRouter` (mounted at root, no
   prefix), mirroring `/prompt-categories`. — consequence if wrong: path differs; trivial to adjust.
2. Unknown/extra body properties are stripped by the schema (Zod object default), not
   rejected. — consequence if wrong: strict rejection would need `.strict()` and an extra test.
3. The handler consumes the validated body via `req.parsedRequest as CreatePromptRequest`
   (the middleware sets `parsedRequest`, typed `unknown`); no change to `express.d.ts`. —
   consequence if wrong: a typed accessor would be a broader, separate concern.
4. `res.json` serialization of the mapped `Date` values (`created_at`/`updated_at`) to ISO strings is the intended
   wire format, consistent with the rest of the app. — consequence if wrong: a serializer
   change is out of scope here.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `errorMiddleware` importing a domain error class couples the HTTP layer to a module's domain. | low | low | The middleware is an unclassified boundaries element (no `from` rule) — `boundaries/no-unknown` is off — so this is permitted, mirroring its existing `RequestValidationError` import; confirmed against `.eslintrc`. |
| R2 | This is the first `validateRequestMiddleware` consumer; the `parsedRequest`-as-`unknown` cast sets a precedent. | med | low | Establish the `z.infer` + single cast pattern in the handler; keep it localized so a future typed-accessor spec can supersede it. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Happy path, no description | `{ title, prompt, category_id }` for an existing category | `201` + prompt without a `description` key, with `created_at`/`updated_at`; row persisted | AC1 |
| Happy path, with description | as above + `description` | `201` + prompt including `description`; row persisted | AC1 |
| Missing required field | body without `title` (or `prompt`) | `400` E1, `details.body.title` reason; nothing persisted | AC2 |
| Non-text value | `title` sent as a number | `400` E1, `details.body.title` reason | AC2 |
| Malformed category_id | `category_id: "not-a-uuid"` | `400` E1, `details.body.category_id` reason; existence check never runs | AC2 |
| Well-formed unknown category_id | `category_id` a valid uuid matching no category | `422` E2, `{ error: 'CategoryNotFoundError', message: 'Category not found: <id>' }`; nothing persisted | AC3 |
| Storage failure | category exists but repository `create` throws | `500` E3 generic internal error | AC4 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 title | §5 V1 — `CreatePromptSchema.body.title` |
| V2 prompt | §5 V2 — `CreatePromptSchema.body.prompt` |
| V3 category_id well-formed | §5 V3 — `z.string().uuid()` |
| V4 description optional | §5 V4 — `z.string().optional()` |
| V5 category exists | §5 V5 — `CreatePromptUseCase` (existing) |
| E1 validation failed | §3 table — existing `validateRequestMiddleware` + `errorMiddleware` |
| E2 category not found | §3 table — new `errorMiddleware` 422 branch |
| E3 internal failure | §3 table — existing `errorMiddleware` default branch |
| AC1 create success | §2 handler + route; §8 happy-path rows |
| AC2 validation failure | §5 V1–V4; §8 missing/non-text/malformed rows |
| AC3 category not found | §3 E2; §8 unknown-category_id row |
| AC4 internal failure | §3 E3; §8 storage-failure row |
| Fields title/prompt/category_id/description | §3 request contract; §2 schema |
| Returned id/category/created_at/updated_at | §3 success response (existing use case `Prompt`, snake_case-mapped in the handler) |
| D7 snake_case wire + boundary mapping | §1 approach; §2 handler; §3 request/response contract |
