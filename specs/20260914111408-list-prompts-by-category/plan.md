# Plan: List prompts, optionally filtered by category
Spec: specs/20260914111408-list-prompts-by-category/spec.md

## 1. Approach

The whole change lands in the **HTTP layer**. The business-logic layers already
implement this feature end to end and are already covered by tests:

- `ListPromptsUseCase.invoke(query?: ListPromptsQuery)` accepts an optional
  `categoryId` and forwards it to the repository
  (`src/modules/prompt/application/ListPromptsUseCase.ts`), unit-tested in
  `tests/unit/modules/prompt/application/ListPromptsUseCase.test.ts` (including
  "forwards a supplied category filter to the repository unchanged").
- `PromptFilter = { categoryId?: string }`
  (`src/modules/prompt/domain/Prompt.ts`) and
  `PromptRepositoryInterface.findAll(filter?)`
  (`src/modules/prompt/domain/interfaces/PromptRepositoryInterface.ts`) already
  carry the optional filter.
- `DrizzlePromptRepository.findAll`
  (`src/modules/prompt/infrastructure/database/DrizzlePromptRepository.ts`)
  applies the filter and orders `desc(createdAt), id`, covered by
  `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`
  ("returns every prompt joined with its category, most-recent-first",
  "returns only prompts belonging to a given category", "returns an empty array
  when the category filter matches nothing").
- The use case is already wired in `src/modules/prompt/services.ts:20` as
  `listPromptsUseCase`; nothing currently calls it.

So this plan adds only what is missing: a request schema declaring the optional
`category_id` query parameter, a list response schema, a handler, the route, and
the OpenAPI path. It follows the shape of the existing `getPromptHandler` (single
prompt) and `listPromptCategoriesHandler` (collection) exactly, and reuses
`uuidField()` from `src/routes/shared/fields.schema.ts` for V1 so the malformed
filter produces the project's standard validation envelope with no new error code.

The handler is the sole place `category_id` (wire, `snake_case`) becomes
`categoryId` (domain, `camelCase`), per CLAUDE.md's boundary rule.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `ListPromptsSchema` + `ListPromptsRequest` | new (in existing file) | `src/routes/prompts/prompts.request.schema.ts` | Add `z.object({ query: z.object({ category_id: uuidField().optional() }) })` and its inferred type, alongside the existing prompt request schemas. |
| `PromptListResponseSchema` + `PromptListResponse` | new (in existing file) | `src/routes/prompts/prompts.response.schema.ts` | Add `z.array(PromptResponseSchema)` and its inferred type, mirroring `PromptCategoryListResponseSchema`. |
| `listPromptsHandler` | new | `src/handlers/prompts/listPromptsHandler.ts` | Read `query.category_id` from `req.parsedRequest`, call `listPromptsUseCase.invoke({ categoryId })`, map each prompt to the wire shape (`description || null`, `created_at`/`updated_at` via `.toISOString()`), respond `200`. |
| `promptsRouter` | existing | `src/routes/prompts/prompts.routes.ts` | Add `promptsRouter.get('/prompts', validateRequestMiddleware(ListPromptsSchema), listPromptsHandler)`. No `requireAuthMiddleware` (spec §6 Decision 2). |
| `promptsPaths` | existing | `src/docs/prompts.ts` | Add a `get` operation under the existing `'/prompts'` key: `requestParams: { query: ListPromptsSchema.shape.query }`, responses `200` (`PromptListResponseSchema`), `400` (`validationErrorResponse`), `429` (`rateLimitedResponse`); no `security`. |
| `ListPromptsUseCase` | existing | `src/modules/prompt/application/ListPromptsUseCase.ts` | **No change** — already accepts the optional `categoryId`. |
| `PromptFilter` / `PromptRepositoryInterface` / `DrizzlePromptRepository` | existing | `src/modules/prompt/domain/…`, `…/infrastructure/database/DrizzlePromptRepository.ts` | **No change** — already filter and order as §1 requires. |
| `promptRepository` wiring | existing | `src/modules/prompt/services.ts` | **No change** — `listPromptsUseCase` is already exported. |

## 3. Interfaces & contracts

Route: `GET /prompts` — public, behind the global rate limiter only.

Request (validated into `req.parsedRequest`):

```ts
ListPromptsSchema = z.object({
    query: z.object({ category_id: uuidField().optional() }),
});
```

Handler → use case (domain `camelCase`):

```ts
listPromptsUseCase.invoke({ categoryId: query.category_id });
```

`ListPromptsQuery.categoryId` is already `string | undefined`, so an absent
`category_id` passes through as `undefined` and the repository builds no
`where` clause — the unfiltered collection.

Response `200` — a JSON array; each element is exactly `PromptResponseSchema`
(the shape `getPromptHandler` already returns):

```
[ { id, title, prompt, description: string | null,
    category: { id, name }, user: { id, name },
    created_at: ISO-8601, updated_at: ISO-8601 } ]
```

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | none — rejected before the domain, by `validateRequestMiddleware` throwing `ApiError(400, 'VALIDATION_ERROR', …)` | `400 { status: 400, code: 'VALIDATION_ERROR', message: 'Request Validation data failed', details: { query: { category_id: 'Invalid UUID value' } } }` |

## 4. Data & persistence

None. No table, column, or migration changes — the query this feature needs is
already implemented in `DrizzlePromptRepository.findAll`.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `category_id`, when supplied, is a well-formed UUID; omitting it is valid | `validateRequestMiddleware(ListPromptsSchema)` on the route, via `uuidField().optional()` | → E1 |
| V2 | A well-formed `category_id` is never checked for existence | Nowhere — deliberately no category lookup; `findAll` simply matches no rows | — |

## 6. Dependency changes

None.

## 7. Assumptions & risks

Assumptions (trivial, decided silently):
1. The handler file and its default export are named `listPromptsHandler`, per the project's handler-suffix convention — consequence if wrong: a rename, no behavior change.
2. The new schemas are added to the **existing** `prompts.request.schema.ts` / `prompts.response.schema.ts` files rather than new ones, matching how every other prompt schema is declared — consequence if wrong: a file move, no behavior change.
3. `description` is mapped with `prompt.description || null`, copied verbatim from `getPromptHandler`, so an empty-string description also reports as empty — consequence if wrong: an empty-string description would surface as `""` instead of `null`, diverging from the single-prompt read.
4. The `get` operation is added under the existing `'/prompts'` key in `src/docs/prompts.ts`, next to the `post` already there — consequence if wrong: duplicate keys would silently drop one operation from the document; AC8's test catches it.
5. Integration tests assert over the subset of the response matching this suite's fixture ids (the pattern used by `listPromptCategoriesHandler.test.ts` and `DrizzlePromptRepository.test.ts`), so rows left by other suites cannot make them flaky — consequence if wrong: intermittent failures when suites run together.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | An unfiltered `GET /prompts` returns the entire table with no paging, growing unbounded | med | Slow responses and large payloads as the catalogue grows | Accepted for now (spec §6 Decision 5); paging is a separate spec. The global rate limiter caps request volume in the meantime. |
| R2 | The public endpoint exposes every prompt's owner id and name to anonymous callers | med | Owner enumeration across the whole catalogue, not just one prompt at a time | Accepted — the same data is already public per prompt via `GET /prompts/:id` (get-prompt-by-id spec, Decision 2); confirmed here as Decision 2. |
| R3 | Adding a `GET /prompts` route resurrects a path an earlier clean-up deliberately removed | low | A previously-404 path starts answering | Intended: this spec re-introduces it deliberately, with a different contract. `tests/integration/app.test.ts` no longer asserts `GET /prompts` → 404, so nothing conflicts. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No filter | `GET /prompts` | Every prompt, newest-created first | AC1, AC2 |
| Filter matches a populated category | `GET /prompts?category_id=<existing id>` | Only that category's prompts | AC3 |
| Filter matches an existing but empty category | `GET /prompts?category_id=<category with no prompts>` | `200 []` | AC4 |
| Filter names a non-existent category | `GET /prompts?category_id=<random UUID>` | `200 []` — identical to the empty-category case | AC4 |
| No prompts exist at all | `GET /prompts` against an empty catalogue | `200 []` | AC4 (same empty-collection behavior; asserted via the filter, which is deterministic under parallel suites) |
| Malformed filter | `GET /prompts?category_id=abc` | `400` validation envelope naming `query.category_id` | AC5 |
| Empty filter value | `GET /prompts?category_id=` | `400` — an empty string is present but not a well-formed identifier, so V1 rejects it rather than treating it as "no filter" | AC5 |
| Prompt without a description | A prompt whose description is absent | Its `description` is `null` in the list | AC6 |
| Credentials supplied | `GET /prompts` with a bearer token | Same result as without — the token is neither required nor consulted | AC1 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| §2 field `category_id` | `ListPromptsSchema.query.category_id` (§2, §3); handler maps it to `categoryId` (§3) |
| §2 returned fields | `PromptListResponseSchema = z.array(PromptResponseSchema)` (§2, §3); handler mapping (§3) |
| V1 | §5 row V1 — `uuidField().optional()` in `ListPromptsSchema` |
| V2 | §5 row V2 — no existence check anywhere |
| E1 | §3 error table — `validateRequestMiddleware` → `ApiError(400, 'VALIDATION_ERROR')` |
| AC1 | Route + handler (§2); §8 "No filter", "Credentials supplied" |
| AC2 | `DrizzlePromptRepository.findAll` ordering, unchanged (§1); §8 "No filter" |
| AC3 | Handler `categoryId` mapping (§3); §8 "Filter matches a populated category" |
| AC4 | §5 row V2; §8 empty-category / non-existent-category / empty-catalogue rows |
| AC5 | §5 row V1; §3 error table; §8 "Malformed filter", "Empty filter value" |
| AC6 | Handler `description \|\| null` mapping (§2, §7 assumption 3); §8 "Prompt without a description" |
| AC7 | `PromptListResponseSchema` (§2, §3) |
| AC8 | `promptsPaths` `'/prompts'.get` (§2) |
