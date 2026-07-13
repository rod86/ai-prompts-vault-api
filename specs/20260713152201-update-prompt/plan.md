# Plan: Update prompt
Spec: specs/20260713152201-update-prompt/spec.md

## 1. Approach
Like create-prompt (`specs/20260713111541-create-prompt/`), this feature is purely
the **HTTP layer** over an already-built use case. The `UpdatePromptUseCase`
(`src/modules/prompt/application/UpdatePromptUseCase.ts`) already: looks the prompt up
by id (throwing `PromptNotFoundError` when absent); resolves the category, reusing the
existing one when `categoryId` is unchanged and otherwise looking it up (throwing
`CategoryNotFoundError` when absent); sets `updatedAt` from the injected `DateTime`;
persists via `DrizzlePromptRepository.update`, wrapping storage failures in
`PromptUpdateError`; preserves `id` and `createdAt`; and returns a full `Prompt` (with
expanded category). It is already wired as `updatePromptUseCase` in
`src/modules/prompt/services.ts`. No domain, application, infrastructure, or migration
work is needed.

Client-facing names are **snake_case** (spec D8), while the domain use case is
camelCase (`UpdatePromptQuery.{id, categoryId}`; `Prompt.{createdAt, updatedAt}`). The
handler therefore **maps at the HTTP boundary** — path `id` + `category_id → id`,
`categoryId` on the way in, and `createdAt/updatedAt → created_at/updated_at` on the way
out. The mapping is done **inline in the handler** (mirrors create-prompt); no serializer
module.

We add, following the `node-express-typescript` skill and the existing
`createPromptHandler` precedent:
1. An `UpdatePromptSchema` for the request, extending `src/routes/prompts.schema.ts`,
   validating both the **path** (`params.id` as a uuid — the first param-validating
   schema in the project) and the snake_case **body** (`title`, `prompt`, `category_id`,
   `description?`).
2. An `updatePromptHandler` that reads the validated `params` + `body` from
   `req.parsedRequest`, maps them to the camelCase `UpdatePromptQuery`, calls
   `updatePromptUseCase.invoke`, and responds `200` with the returned prompt mapped to
   the snake_case response shape.
3. A route `PUT /prompts/:id` on the existing `promptsRouter`, guarded by
   `validateRequestMiddleware(UpdatePromptSchema)`.
4. An extension of the central `errorMiddleware` to map `PromptNotFoundError` → `404`
   (E2). `CategoryNotFoundError` → `422` (E3) is **already** handled (added by
   create-prompt); validation (E1) and generic-internal (E4) are already handled too —
   so the only new middleware branch is `PromptNotFoundError`.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `UpdatePromptSchema` (+ inferred type) | **new** | `src/routes/prompts.schema.ts` | Add Zod schema `{ params: { id (uuid) }, body: { title, prompt, category_id (uuid), description? } }` — snake_case wire names; export `UpdatePromptRequest = z.infer<...>`. |
| `updatePromptHandler` | **new** | `src/handlers/prompts/updatePromptHandler.ts` | Reads validated `params`/`body` off `req.parsedRequest`, maps `id`/`category_id → id`/`categoryId` into `UpdatePromptQuery`, calls `updatePromptUseCase.invoke`, maps the returned `Prompt` to the snake_case response (`created_at`/`updated_at`), responds `200`. `export default`. |
| `promptsRouter` | existing | `src/routes/prompts.routes.ts` | Add `promptsRouter.put('/prompts/:id', validateRequestMiddleware(UpdatePromptSchema), updatePromptHandler)`. |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Add a branch: `PromptNotFoundError` → `404 { error: err.name, message: err.message }`. |
| `UpdatePromptUseCase` / `updatePromptUseCase` | existing | `.../application/UpdatePromptUseCase.ts`, `.../prompt/services.ts` | **No change** — reused as-is. |
| `PromptNotFoundError` | existing | `.../prompt/domain/errors/PromptNotFoundError.ts` | **No change** — imported by `errorMiddleware`. |
| `CategoryNotFoundError` | existing | `.../prompt/domain/errors/CategoryNotFoundError.ts` | **No change** — already mapped to 422 in `errorMiddleware`. |

`UpdatePromptQuery` (the use case input) is `{ id, title, prompt, categoryId, description? }` —
the validated request maps to it via `id: params.id`, `categoryId: body.category_id`; the
other fields are single-word and pass through unchanged.

## 3. Interfaces & contracts
Request: `PUT /prompts/:id`, JSON body `{ title: string, prompt: string, category_id: string(uuid), description?: string }`.

`UpdatePromptSchema` (validator contract — `RequestSchema` shape):
```
z.object({
  params: z.object({ id: z.uuid(...) }),
  body: z.object({
    title: z.string(...),
    prompt: z.string(...),
    category_id: z.uuid(...),
    description: z.string().optional(),
  }),
})
```
(uuid/string error messages follow the existing `CreatePromptSchema` style —
`'Missing required value'` on `invalid_type`, `'Invalid UUID value'` otherwise.)

Handler: reads `req.parsedRequest as UpdatePromptRequest`, maps to the camelCase query
`{ id: params.id, title: body.title, prompt: body.prompt, categoryId: body.category_id,
description: body.description }`, calls `updatePromptUseCase.invoke(query)`, then maps the
returned `Prompt` to the snake_case response and `res.status(200).json(response)`.

Success response `200`:
```
{ id, title, prompt, description?, category: { id, name }, created_at, updated_at }
```
(`description` present only when submitted; `created_at`/`updated_at` are the camelCase
`createdAt`/`updatedAt` renamed, serialized as ISO strings by `res.json`. The nested
`category` `{ id, name }` keys are single-word, unchanged.)

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `RequestValidationError` (thrown by `validateRequestMiddleware`) | `400 { error: 'RequestValidationError', message: 'Request Validation data failed', details: { params?: { id: <reason> }, body?: { <field>: <reason> } } }` — existing behavior. |
| E2 | `PromptNotFoundError` (thrown by `UpdatePromptUseCase`) | `404 { error: 'PromptNotFoundError', message: 'Prompt not found: <id>' }` — **new** `errorMiddleware` branch. |
| E3 | `CategoryNotFoundError` (thrown by `UpdatePromptUseCase`) | `422 { error: 'CategoryNotFoundError', message: 'Category not found: <id>' }` — existing `errorMiddleware` branch (added by create-prompt). |
| E4 | `PromptUpdateError` / any other error | `500 { error: 'InternalServerError', message: 'Internal server error' }` — existing default branch. |

## 4. Data & persistence
None. No schema or migration changes. Persistence is the existing `prompts` table via
`DrizzlePromptRepository.update`, reused unchanged (updates `promptCategoryId`, `title`,
`prompt`, `description` (null when absent), `updatedAt`; `id`/`createdAt` untouched).

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `id` (path) required, well-formed identifier | `UpdatePromptSchema.params.id` (`z.uuid()`) via `validateRequestMiddleware` | → E1 |
| V2 | `title` required text | `UpdatePromptSchema.body.title` (`z.string()`) | → E1 |
| V3 | `prompt` required text | `UpdatePromptSchema.body.prompt` (`z.string()`) | → E1 |
| V4 | `category_id` required, well-formed identifier | `UpdatePromptSchema.body.category_id` (`z.uuid()`) | → E1 |
| V5 | `description` optional text | `UpdatePromptSchema.body.description` (`z.string().optional()`) | → E1 |
| V6 | referenced prompt must exist | `UpdatePromptUseCase.invoke` (`promptRepository.findById` → `PromptNotFoundError`) — existing | → E2 |
| V7 | referenced category must exist | `UpdatePromptUseCase.invoke` (reuses existing category when unchanged, else `categoryRepository.findById` → `CategoryNotFoundError`) — existing | → E3 |

## 6. Dependency changes
None. `zod`, `express`, `supertest`, and all middleware/use cases are already present.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks
Test structure follows the **updated** `testing-practices` and `node-express-typescript`
skills (spec D9): the integration file seeds the shared parent category once
(`fixtureCategory` in `beforeAll`/`afterAll`) and the per-test prompt inside each `it`
(`fixturePrompt`, cleaned up in the same test), `fixture<Entity>` naming; handler responses
are asserted with an exact whole-body `toEqual` (never a partial match paired with a
follow-up `not.toHaveProperty`); and validation cases live in a nested `Request Validation`
describe. The request-validation **wire envelope is unchanged** — it stays the shipped
`{ error, message, details: { <part>: { <field>: <reason> } } }` (per D9, for consistency
with the already-IMPLEMENTED create-prompt endpoint). The flat `{ errors: [...] }` shape in
the updated skill is only an illustrative example of "assert the involved fields," not a
prescribed envelope, so no shape change is warranted here.

Assumptions (trivial, decided silently):
1. Route path is `PUT /prompts/:id` on the existing `promptsRouter` (mounted at root, no
   prefix), mirroring `POST /prompts`. — consequence if wrong: path differs; trivial to adjust.
2. Unknown/extra body properties are stripped by the schema (Zod object default), not
   rejected. — consequence if wrong: strict rejection would need `.strict()` + a test.
3. The handler consumes the validated request via `req.parsedRequest as UpdatePromptRequest`
   (the middleware sets `parsedRequest`, typed `unknown`); no change to `express.d.ts`. —
   consequence if wrong: a typed accessor is a broader, separate concern.
4. `res.json` serialization of the mapped `Date` values to ISO strings is the intended
   wire format, consistent with the rest of the app. — consequence if wrong: a serializer
   change is out of scope here.
5. Category-not-found is checked **after** prompt-not-found (V6 before V7), per the
   existing use-case ordering — so for a request where both the prompt and the category
   are missing, the client sees E2 (prompt-not-found), not E3. — consequence if wrong:
   the use case, not this HTTP layer, would need reordering (out of scope).

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `errorMiddleware` importing another domain error (`PromptNotFoundError`) further couples the HTTP layer to a module's domain. | low | low | The middleware is an unclassified boundaries element (`boundaries/no-unknown` off) — permitted, mirroring the existing `RequestValidationError`/`CategoryNotFoundError` imports. |
| R2 | This is the first schema to validate `params`; a malformed path `id` must surface under `details.params.id`, not `details.body`. | low | low | `validator.ts` already groups issues by request part (`params`/`query`/`body`); assert `details.params.id` explicitly in the test. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Happy path, no description | `PUT /prompts/:id` `{ title, prompt, category_id }` for an existing prompt + category | `200` + prompt without a `description` key, `created_at` preserved, `updated_at` advanced; row updated, stored `description` null | AC1 |
| Happy path, with description | as above + `description` | `200` + prompt including `description`; row updated | AC1 |
| Description omitted (cleared) | existing prompt that has a description; body without `description` | `200`, exact body has **no** `description` key; stored `description` is `null` | AC1 |
| Description empty string (set) | body with `description: ''` | `200`, exact body includes `description: ''` (present, not omitted); stored `description` is `''` — the distinct nullable-vs-empty state (updated `testing-practices`) | AC1 |
| Happy path, category changed | existing prompt, `category_id` of a different existing category | `200` + prompt with the new `category` {id, name}; row's `promptCategoryId` updated | AC1 |
| Malformed path id | `PUT /prompts/not-a-uuid` well-formed body | `400` E1, `details.params.id` reason; existence check never runs | AC2 |
| Missing required body field | body without `title` (or `prompt`) | `400` E1, `details.body.title` reason; nothing updated | AC2 |
| Non-text value | `title` sent as a number | `400` E1, `details.body.title` reason | AC2 |
| Malformed category_id | valid path id, `category_id: "not-a-uuid"` | `400` E1, `details.body.category_id` reason; existence checks never run | AC2 |
| Well-formed unknown prompt id | valid uuid path id matching no prompt | `404` E2, `{ error: 'PromptNotFoundError', message: 'Prompt not found: <id>' }`; nothing updated | AC3 |
| Precedence: prompt **and** category both missing | valid uuid path id matching no prompt, `category_id` also matching no category | `404` E2 (prompt-not-found wins — existence checked before the category reference); **not** `422` | AC3 |
| Well-formed unknown category_id | existing prompt, `category_id` a valid uuid matching no category | `422` E3, `{ error: 'CategoryNotFoundError', message: 'Category not found: <id>' }`; nothing updated | AC4 |
| Storage failure | prompt + category exist but repository `update` throws | `500` E4 generic internal error | AC5 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 id well-formed | §5 V1 — `UpdatePromptSchema.params.id` (`z.uuid()`) |
| V2 title | §5 V2 — `UpdatePromptSchema.body.title` |
| V3 prompt | §5 V3 — `UpdatePromptSchema.body.prompt` |
| V4 category_id well-formed | §5 V4 — `z.uuid()` |
| V5 description optional | §5 V5 — `z.string().optional()` |
| V6 prompt exists | §5 V6 — `UpdatePromptUseCase` (existing) |
| V7 category exists | §5 V7 — `UpdatePromptUseCase` (existing) |
| E1 validation failed | §3 table — existing `validateRequestMiddleware` + `errorMiddleware` |
| E2 prompt not found | §3 table — new `errorMiddleware` 404 branch |
| E3 category not found | §3 table — existing `errorMiddleware` 422 branch |
| E4 internal failure | §3 table — existing `errorMiddleware` default branch |
| AC1 update success | §2 handler + route; §8 happy-path rows incl. description omitted (null) vs empty-string (present) states |
| AC2 validation failure | §5 V1–V5; §8 malformed-id/missing/non-text/malformed-category rows |
| AC3 prompt not found | §3 E2; §8 unknown-prompt-id row + precedence row (both missing → E2 wins) |
| AC4 category not found | §3 E3; §8 unknown-category_id row |
| AC5 internal failure | §3 E4; §8 storage-failure row |
| Fields id/title/prompt/category_id/description | §3 request contract; §2 schema |
| Returned id/category/created_at/updated_at | §3 success response (existing use case `Prompt`, snake_case-mapped in the handler) |
| D8 snake_case wire + boundary mapping | §1 approach; §2 handler; §3 request/response contract |
