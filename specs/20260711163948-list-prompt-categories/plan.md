# Plan: List prompt categories
Spec: specs/20260711163948-list-prompt-categories/spec.md

## 1. Approach
The entire vertical slice below HTTP already exists and already produces the required
result: `listPromptCategoriesUseCase.invoke()` (wired in `src/modules/prompt/services.ts`)
returns `PromptCategoryResponse[]` (`{ id, name }[]`) from `DrizzlePromptCategoryRepository.findAll()`,
which already orders `lower(name), id`. So this feature only adds the **HTTP layer** — the
first route after `/health`. Following the `node-express-typescript` skill §4/§1 and
grouping by the **prompt** bounded context (categories are part of the prompt context): the
route lives in the prompt resource router `routes/prompts.routes.ts` and the handler under
the prompt handler folder `handlers/prompts/`, aggregated through an api router, plus a
`notFoundHandler` to establish the not-found contract for unknown paths now that the app
starts serving real routes. Scope is deliberately **minimal**
(see §7): no `createApp()` factory, no centralized error handler, no `helmet`/`express.json`.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `ListPromptCategoriesUseCase` | existing | `src/modules/prompt/application/ListPromptCategoriesUseCase.ts` | Reused unchanged — `invoke()` returns `{ id, name }[]`. |
| `listPromptCategoriesUseCase` singleton | existing | `src/modules/prompt/services.ts` | Reused unchanged — the composition-root instance the handler imports. |
| `DrizzlePromptCategoryRepository.findAll` | existing | `src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts` | Reused unchanged — already orders `lower(name), id`. |
| List-categories handler | **new** | `src/handlers/prompts/listPromptCategoriesHandler.ts` | Thin `RequestHandler` `listPromptCategoriesHandler`: `res.status(200).json(await listPromptCategoriesUseCase.invoke())`. Grouped under the prompt context (folder-per-resource, skill §4). |
| Prompt resource router | **new** | `src/routes/prompts.routes.ts` | `promptsRouter = Router()`; `promptsRouter.get('/prompt-categories', listPromptCategoriesHandler)`. The prompt context's router — future prompt routes join here. No `*.schema.ts` — no input. |
| Api router (aggregation seam) | **new** | `src/routes/index.ts` | `apiRouter = Router()`; `apiRouter.use(promptsRouter)`. |
| Not-found middleware | **new** | `src/middleware/notFoundMiddleware.ts` | `notFoundMiddleware(req, res)` → 404 envelope. |
| HTTP app | existing | `src/app.ts` | Mount `app.use(apiRouter)` after `/health`; then `app.use(notFoundHandler)` **last**. Keeps the default-exported `app` instance. |

## 3. Interfaces & contracts
- Use case (unchanged): `invoke(): Promise<PromptCategoryResponse[]>` where `PromptCategoryResponse = { id: string; name: string }`.
- Handler: `export const listPromptCategoriesHandler: RequestHandler` (in `handlers/prompts/`) — reads no input, delegates, responds `200` with the array as JSON. Returns `void`; no `try/catch` (Express 5 auto-forwards rejections).
- Route: `GET /prompt-categories` (defined in the prompt resource router) → `200` with body `Array<{ id: string; name: string }>` ordered by name ascending; empty catalogue → `200 []`.
- Not-found contract: any unmatched path/method → `404` with body `{ error: 'NotFound', message: "Cannot <METHOD> <path>" }`.

| E# | Domain error | Response the user sees |
|--|--|--|
| — | none | Listing has no domain error path (spec §4). An unexpected infrastructure failure falls through to Express 5's built-in handler (generic 500) — accepted under the minimal scope (§7). |

## 4. Data & persistence
none — read-only over the existing `prompt_categories` table; no schema change, no migration.

## 5. Validation
none — the request carries no input (spec §3), so there is no validation layer and no `validate()` middleware.

## 6. Dependency changes
none — `express`/`@types/express` and `supertest` are already present; no new packages.

## 7. Assumptions & risks
Assumptions:
1. **Minimal HTTP scope** — no `createApp()` factory, no centralized `errorHandler`/`AppError`, no `helmet`/`express.json`. Consequence if wrong: an unexpected DB failure returns Express's default 500 (HTML/JSON) instead of a shaped envelope, and there is no security-header/body-parser layer yet — acceptable for a read-only, input-less GET; these arrive with the first route that needs them.
2. **Root route path** — mounted at `/prompt-categories` (no `/api` prefix), mirroring `/health`. Consequence if wrong: a later `/api` convention would require re-mounting `apiRouter` under a prefix (one-line change).
3. **`notFoundHandler` included** though no domain AC requires it — it establishes the 404 contract CLAUDE.md's testing section references. Consequence if wrong: none functional; it is additive infrastructure.
4. **Ordering delegated entirely to the repository** (`lower(name), id`) — the handler does not re-sort. Consequence if wrong: if repo ordering regressed, AC1 would fail; covered by the endpoint test asserting order.
5. **HTTP files live at the repo root, grouped by bounded context** (`src/routes/prompts.routes.ts`, `src/handlers/prompts/`, `src/middleware`) — `eslint-plugin-boundaries` treats these root files as unknown elements (`boundaries/no-unknown` off), so they may import a context's `services.ts` freely, as `app.ts` already does. Grouping the HTTP layer by the prompt resource (not inside `src/modules/prompt/`) keeps it a thin translator over the context's `services.ts`. Consequence if wrong: lint would fail; verified by `npm run lint`.
6. **Suffix convention** — handler files/identifiers end with `Handler` (`listPromptCategoriesHandler.ts` → `listPromptCategoriesHandler`); middleware files/identifiers end with `Middleware` (`notFoundMiddleware.ts` → `notFoundMiddleware`). Router files/identifiers are unaffected (`prompts.routes.ts` → `promptsRouter`, `apiRouter`). Consequence if wrong: purely cosmetic; a rename.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | DB unreachable at request time → unshaped 500 | low | low (read-only) | Accepted per §7.1; revisit when the centralized error handler lands. |
| R2 | Root-mounted `apiRouter` collides with a future root route | low | low | `/health` stays inline; distinct paths; `/api` prefix remains a trivial future change. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Empty catalogue | No categories exist | `200` with `[]` | AC2 — no dedicated integration case: the seeded reference categories (`drizzle/0001_seed_prompt_categories.sql`) make a truly empty table unreachable in this environment without deleting shared fixture data other integration suites depend on. The handler is an unconditional pass-through with no branch on result size, and the empty-array case is already proven at the unit level (`ListPromptCategoriesUseCase.test.ts`), so AC2 is accepted as covered without a new integration test. |
| Case-differing names | e.g. `apple`, `Banana`, `cherry` | Case-insensitive ascending order | AC1 |
| Unknown path | `GET /does-not-exist` | `404` `{ error: 'NotFound', message: 'Cannot GET /does-not-exist' }` | none (HTTP not-found contract, not a domain AC) |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| AC1 (all categories, id+name, name-ascending) | Handler `list` (§2/§3) → existing `listPromptCategoriesUseCase` → `DrizzlePromptCategoryRepository.findAll` (`lower(name), id`); endpoint test asserts order (§8) |
| AC2 (empty → empty list) | Handler returns the use case's `[]` unchanged (§3); proven at unit level, not by a new integration case — empty-catalogue edge case (§8) |
| Field `id` | `PromptCategoryResponse.id` in the JSON array element (§3) |
| Field `name` | `PromptCategoryResponse.name` in the JSON array element (§3) |
