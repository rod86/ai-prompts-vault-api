# Tasks: List prompts, optionally filtered by category
Plan: specs/20260914111408-list-prompts-by-category/plan.md

All tasks land in the HTTP layer — the domain, application, and infrastructure
layers already implement the filtered listing and are already covered (plan §1),
so there is no migration, domain, application, or infrastructure task here.

T1 introduces the whole surface (request schema, response schema, handler,
route); T2–T7 each pin one further behavior on that surface with a single test
and need no production change beyond what they prove; T8 documents the operation.

New test file for T1–T7: `tests/integration/handlers/prompts/listPromptsHandler.test.ts`.
Follow `listPromptCategoriesHandler.test.ts` and `getPromptHandler.test.ts` for
wiring: `createPromptCategoryFixture` / `createUserFixture` / `createPromptFixture`
from `@tests/lib/config.js`, shared category and user rows inserted in
`beforeAll`, per-test prompts in the `it`, `promptFixture.cleanup()` in
`afterEach` and category/user cleanup in `afterAll`. Assert over the subset of the
response matching this suite's fixture ids (plan §7 assumption 5), and give each
test a unique `X-Forwarded-For` IP so the shared rate-limit allowance is not
pooled.

- [ ] T1. `GET /prompts` returns every prompt with full details, unauthenticated
  - Type: route handler
  - Depends on: none
  - Red: in the new `listPromptsHandler.test.ts`, insert two prompts via the fixtures, then `request(app).get('/prompts')` with **no** `Authorization` header; assert `200` and that the entries matching the two fixture ids equal their full wire shape — `id`, `title`, `prompt`, `description`, `category: { id, name }`, `user: { id, name }`, `created_at`/`updated_at` as the fixtures' instants in ISO-8601. Fails now with `404 NOT_FOUND` — `/prompts` has no `GET` route.
  - Green: add `ListPromptsSchema` + `ListPromptsRequest` to `src/routes/prompts/prompts.request.schema.ts` (`query.category_id` as `uuidField().optional()`); add `PromptListResponseSchema` + `PromptListResponse` to `src/routes/prompts/prompts.response.schema.ts` (`z.array(PromptResponseSchema)`); add `src/handlers/prompts/listPromptsHandler.ts` calling `listPromptsUseCase.invoke({ categoryId: query.category_id })` and mapping each prompt to the wire shape (`description || null`, instants via `.toISOString()`); register `promptsRouter.get('/prompts', validateRequestMiddleware(ListPromptsSchema), listPromptsHandler)` in `src/routes/prompts/prompts.routes.ts`, without `requireAuthMiddleware`.
  - Covers: AC1 "Given prompts exist, When a consumer asks for the collection **without supplying any credentials** and without a filter, Then every one of those prompts is returned with its full details: identifier, title, prompt text, description, category (identifier and name), owner (identifier and name), and creation and last-update instants."; §2 returned fields

- [ ] T2. The collection is ordered most-recently-created first
  - Type: route handler
  - Depends on: T1
  - Red: insert an older prompt (`createdAt` in the past) and a newer one (`createdAt` recent), `GET /prompts`, and assert the ids of this suite's two fixtures appear in the response in newest-first order.
  - Green: none expected — `DrizzlePromptRepository.findAll` already orders `desc(createdAt), id`. If the test fails, the defect is in the handler preserving the use case's order.
  - Covers: AC2 "Given prompts created at different instants, When a consumer asks for the collection, Then they are returned most-recently-created first."

- [ ] T3. A category filter narrows the collection to that category
  - Type: route handler
  - Depends on: T1
  - Red: insert one prompt in category A and one in category B, then `GET /prompts?category_id=<A.id>`; assert `200` and that the response contains the category-A prompt's id and not the category-B prompt's id.
  - Green: none expected beyond T1's `categoryId` mapping — this proves `category_id` (wire) reaches the use case as `categoryId` (domain).
  - Covers: AC3 "Given prompts belonging to more than one category, When a consumer asks for the collection narrowed to one category's identifier, Then only the prompts belonging to that category are returned."; §2 field `category_id`

- [ ] T4. A well-formed filter matching no prompts returns an empty collection
  - Type: route handler
  - Depends on: T1
  - Red: `GET /prompts?category_id=<a freshly generated UUID belonging to no category>`; assert `200` and a body of `[]`.
  - Green: none expected — no existence check is performed anywhere (plan §5, V2).
  - Covers: AC4 "Given a well-formed category identifier that matches no prompts, When a consumer asks for the collection narrowed to it, Then an empty collection is returned rather than an error."; V2

- [ ] T5. A malformed category filter is rejected
  - Type: route handler
  - Depends on: T1
  - Red: `GET /prompts?category_id=abc`; assert `400` and the exact envelope `{ status: 400, code: 'VALIDATION_ERROR', message: 'Request Validation data failed', details: { query: { category_id: 'Invalid UUID value' } } }` in a single statement.
  - Green: none expected — `uuidField().optional()` from T1 produces this. If the message differs, correct the schema, not the assertion.
  - Covers: AC5 "Given a malformed category filter, When a consumer asks for the collection narrowed to it, Then an invalid-filter error (E1) is returned."; V1, E1

- [ ] T6. A prompt with no description reports it as empty
  - Type: route handler
  - Depends on: T1, T3
  - Red: insert a prompt with `description: null` in its own category, `GET /prompts?category_id=<that category>`, and assert the returned entry's `description` is `null`.
  - Green: none expected — T1's `description || null` mapping covers it.
  - Covers: AC6 "Given a prompt that has no description, When a consumer asks for the collection, Then that prompt's description is reported as empty rather than omitted."; §2 field `description`

- [ ] T7. The collection conforms to its documented shape
  - Type: route handler
  - Depends on: T1
  - Red: insert a prompt, `GET /prompts`, and assert `expect(() => PromptListResponseSchema.parse(response.body)).not.toThrow()` — the per-endpoint truthfulness assertion required by CLAUDE.md, mirroring `listPromptCategoriesHandler.test.ts`.
  - Green: none expected — proves T1's `PromptListResponseSchema` describes what the handler actually returns.
  - Covers: AC7 "Given prompts exist, When a consumer asks for the collection, Then the returned collection conforms to the documented shape of a prompt list."

- [ ] T8. The API description documents the list operation
  - Type: route handler
  - Depends on: T1
  - Red: in `tests/integration/docs.test.ts`, extend the prompt-endpoints test to assert `Object.keys(paths['/prompts'].get.responses).sort()` equals `['200', '400', '429']` and that `paths['/prompts'].get.security` is `undefined`. Fails now — `paths['/prompts']` has no `get`.
  - Green: add the `get` operation under the existing `'/prompts'` key in `src/docs/prompts.ts`: `tags: ['Prompts']`, a summary, `requestParams: { query: ListPromptsSchema.shape.query }`, `'200'` → `PromptListResponseSchema`, `'400'` → `validationErrorResponse('Invalid input')`, `'429'` → `rateLimitedResponse`, and no `security` key.
  - Covers: AC8 "Given the running API, When the API description document is retrieved, Then it lists the list-prompts operation with its optional category filter and exactly the outcomes it can produce — success, invalid filter, and allowance exhausted — and without a credential requirement."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given prompts exist, When a consumer asks for the collection **without supplying any credentials** and without a filter, Then every one of those prompts is returned with its full details: identifier, title, prompt text, description, category (identifier and name), owner (identifier and name), and creation and last-update instants. | T1 |
| AC2 | Given prompts created at different instants, When a consumer asks for the collection, Then they are returned most-recently-created first. | T2 |
| AC3 | Given prompts belonging to more than one category, When a consumer asks for the collection narrowed to one category's identifier, Then only the prompts belonging to that category are returned. | T3 |
| AC4 | Given a well-formed category identifier that matches no prompts, When a consumer asks for the collection narrowed to it, Then an empty collection is returned rather than an error. | T4 |
| AC5 | Given a malformed category filter, When a consumer asks for the collection narrowed to it, Then an invalid-filter error (E1) is returned. | T5 |
| AC6 | Given a prompt that has no description, When a consumer asks for the collection, Then that prompt's description is reported as empty rather than omitted. | T6 |
| AC7 | Given prompts exist, When a consumer asks for the collection, Then the returned collection conforms to the documented shape of a prompt list. | T7 |
| AC8 | Given the running API, When the API description document is retrieved, Then it lists the list-prompts operation with its optional category filter and exactly the outcomes it can produce — success, invalid filter, and allowance exhausted — and without a credential requirement. | T8 |
