# Tasks: List prompts
Plan: specs/002-list-prompts/plan.md
Status: READY FOR REVIEW

- [ ] T1. Use case returns every prompt provided by the repository, fully shaped
  - Red: `tests/unit/logic/prompt/application/ListPromptsUseCase.test.ts` —
    construct `ListPromptsUseCase` with a `mock<PromptRepositoryInterface>()`
    (per `docs/testing.md`); set `repository.findAll.mockResolvedValue([...])`
    with two fixture `Prompt` objects (all fields set, via faker); call
    `useCase.invoke()`; assert the result equals the two fixtures exactly,
    including the nested `category` object. Fails: the `Prompt` type,
    `PromptRepositoryInterface` port, and `ListPromptsUseCase` class do not
    exist yet.
  - Green: create `src/logic/prompt/domain/Prompt.ts` (with the nested
    `category: { id, name }` field),
    `src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`
    (with the `PromptFilter` type), and
    `src/logic/prompt/application/ListPromptsUseCase.ts` whose `invoke()`
    calls `this.repository.findAll({ categoryId: query.categoryId })` and
    returns the result.
  - Covers: AC1 "Given multiple prompts exist, When the user requests the
    list of prompts, Then the response includes every prompt, each with
    its id, category (id and name), title, prompt text, description,
    createdAt, and updatedAt."

- [ ] T2. Use case returns an empty array when the repository has none
  - Red: same file as T1 — new `it`; `repository.findAll.mockResolvedValue([])`;
    call `useCase.invoke()`; assert it resolves to `[]`.
  - Green: no production change expected if T1's `invoke()` simply returns
    the repository's result; run the test to confirm the empty case already
    passes without special-casing.
  - Covers: AC3 "Given no prompts exist, When the user requests the list
    of prompts, Then the response is an empty list, not an error."

- [ ] T3. Use case forwards a supplied category filter to the repository unchanged
  - Red: same file as T1 — new `it`; call `useCase.invoke({ categoryId: '<fixture-id>' })`;
    assert `repository.findAll` was called with `{ categoryId: '<fixture-id>' }`.
  - Green: no production change expected if T1's `invoke()` already forwards
    `query.categoryId`; run the test to confirm.
  - Covers: AC4 "Given prompts exist in more than one category, When the
    user requests the list of prompts filtered by a category that has
    prompts, Then the response includes only the prompts belonging to that
    category." (use-case-level forwarding; filtering itself is proven at
    the repository level in T7).

- [ ] T4. Install the `zod` dependency
  - Red: `tests/unit/handlers/schemas/GetPromptsQuerySchema.test.ts` —
    import `GetPromptsQuerySchema` from the not-yet-created schema file,
    which itself imports `zod`; running the suite fails because neither the
    module nor the `zod` package resolve.
  - Green: run `npm install zod@^3` (per plan.md §8); the import failure
    changes from "module not found" to "file not found," setting up T5.
  - Covers: no AC directly (dependency install); required before T5/T11's
    HTTP boundary validation, per plan.md §8.

- [ ] T5. Query schema accepts an optional `category` string and passes it through
  - Red: same file as T4 — `it('parses a present category value')` asserts
    `GetPromptsQuerySchema.parse({ category: 'abc' })` equals
    `{ category: 'abc' }`; `it('parses a missing category value')` asserts
    `GetPromptsQuerySchema.parse({})` equals `{ category: undefined }`.
    Fails: `src/handlers/schemas/GetPromptsQuerySchema.ts` does not exist.
  - Green: create `src/handlers/schemas/GetPromptsQuerySchema.ts` exporting
    `z.object({ category: z.string().optional() })` (plan.md §6).
  - Covers: no AC directly (HTTP-boundary schema, no V# per spec §3); supports
    the request parsing used by AC4 and AC5 at the route level (T13, T14).

- [ ] T6. Repository returns every prompt joined with its category, most-recent-first
  - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` —
    per `docs/testing.md` integration conventions, open the DB connection
    once in `beforeAll`; insert a fixture category via the existing
    `tests/lib/seeding/promptCategories.ts` helper; insert fixture prompts
    (all fields set, including `description`) referencing that category,
    with `createdAt` values deliberately out of order, via a new
    `tests/lib/seeding/prompts.ts` helper; call
    `new DrizzlePromptRepository(db).findAll()`; assert the returned array
    contains the inserted prompts sorted by `createdAt` descending, each
    shaped `{ id, category: { id, name }, title, prompt, description,
    createdAt, updatedAt }` with correct values; delete only the inserted
    rows in `afterEach`; close the connection in `afterAll`. Fails: the
    `prompts` table, schema, and repository class do not exist yet.
  - Green: add the `prompts` table to
    `src/logic/prompt/infrastructure/database/schema.ts` (`id` uuid primary
    key with no default; `prompt_category_id` uuid not null referencing
    `prompt_categories.id`; `title`/`prompt` text not null; `description`
    text nullable; `created_at`/`updated_at` timestamptz not null — all
    application-supplied, per `docs/database.md`); generate and apply the
    table-creation migration (`npx drizzle-kit generate`,
    `npx drizzle-kit migrate`); implement
    `DrizzlePromptRepository.findAll()` joining `prompts` to
    `prompt_categories`, ordering by `desc(prompts.createdAt), prompts.id`,
    and mapping `description ?? undefined`.
  - Covers: AC1 (see T1 text above); AC2 "Given multiple prompts exist,
    When the user requests the list of prompts (with or without a category
    filter), Then the prompts are ordered from most recently created to
    least recently created."

- [ ] T7. Repository returns only prompts belonging to a given category
  - Red: same file as T6 — new `it`; insert two fixture categories and
    prompts split across both; call
    `new DrizzlePromptRepository(db).findAll({ categoryId: categoryA.id })`;
    assert the result contains only category A's prompts, most-recent-first.
  - Green: apply `filter?.categoryId` as a `where` clause
    (`eq(prompts.promptCategoryId, filter.categoryId)`) in `findAll()`.
  - Covers: AC4 (see T3 text above).

- [ ] T8. Repository returns an empty array when the category filter matches nothing
  - Red: same file as T6 — new `it`; call `findAll({ categoryId: faker.string.uuid() })`
    with an id that matches no inserted category/prompt; assert the result
    is `[]`.
  - Green: no production change expected; the `where` clause from T7
    naturally yields no rows for a non-matching id. Run the test to confirm.
  - Covers: AC5 "Given a category filter value that matches no prompt —
    because no such category exists, or it exists but currently has no
    prompts — When the user requests the list of prompts filtered by that
    value, Then the response is an empty list, not an error."

- [ ] T9. Repository returns an empty array when there are no prompts at all
  - Red: same file as T6 — new `it`; with no prompt rows inserted for this
    test (only the shared fixture category, no prompts), call `findAll()`
    with no filter; assert the result is `[]`.
  - Green: no production change expected; confirm the existing `findAll()`
    already returns `[]` for a prompt-less table.
  - Covers: AC3 (see T2 text above).

- [ ] T10. Repository represents a prompt with no description as an absent value
  - Red: same file as T6 — new `it`; insert a fixture prompt with no
    `description` (via the seeding helper, omitting the field/passing
    `undefined`); call `findAll()`; assert the matching result item's
    `description` is `undefined` (not `null`, not throwing).
  - Green: no production change expected if T6's `description ?? undefined`
    mapping is already in place; run the test to confirm.
  - Covers: AC6 "Given a prompt that was created without a description,
    When the user requests the list of prompts, Then that prompt is
    included in the response with no description value, rather than an
    error or being left out of the list."

- [ ] T11. `GET /prompts` returns all prompts ordered most-recently-created-first
  - Red: `tests/integration/app.test.ts` — using `supertest` against the
    real Express `app`, seed a fixture category and fixture prompts (via
    the seeding helpers, `createdAt` out of order) referencing it; `GET
    /prompts`; assert status `200` and that the JSON body is an array
    containing every expected prompt, each with `id`, nested `category`,
    `title`, `prompt`, `description`, `createdAt`, `updatedAt`, sorted
    most-recently-created-first; clean up only the inserted fixture rows
    afterward. Fails: no `prompts` route, handler, use-case wiring, or
    query schema wiring exists yet in the route layer.
  - Green: create `src/handlers/GetPrompts.ts` (default export) that
    parses `req.query` with `GetPromptsQuerySchema`, calls
    `listPromptsUseCase.invoke({ categoryId: category })`, and responds
    `200` with the JSON array; add
    `listPromptsUseCase = new ListPromptsUseCase(new DrizzlePromptRepository(databaseClient.connect()))`
    to `src/logic/prompt/services.ts`; register
    `app.get('/prompts', getPromptsHandler)` in `src/app.ts`.
  - Covers: AC1, AC2 (see texts above).

- [ ] T12. `GET /prompts` returns an empty list when there are no prompts
  - Red: same file as T11 — new `it`; with no prompt fixtures inserted for
    this test, `GET /prompts`; assert status `200` and body equals `[]`.
  - Green: no production change expected; confirm the endpoint already
    responds `200` with `[]`.
  - Covers: AC3 (see text above).

- [ ] T13. `GET /prompts?category={id}` returns only prompts in that category
  - Red: same file as T11 — new `it`; seed two fixture categories and
    prompts split across both; `GET /prompts?category=<categoryA.id>`;
    assert status `200` and body contains only category A's prompts,
    most-recent-first.
  - Green: no production change expected if T11's handler already forwards
    `category` from the parsed query to the use case; run the test to
    confirm.
  - Covers: AC4 (see text above).

- [ ] T14. `GET /prompts?category={unknown}` returns an empty list
  - Red: same file as T11 — new `it`; `GET /prompts?category=<random uuid
    matching nothing>`; assert status `200` and body equals `[]`.
  - Green: no production change expected; confirm the endpoint already
    responds `200` with `[]` for a non-matching filter.
  - Covers: AC5 (see text above).

- [ ] T15. `GET /prompts` includes a prompt with no description, with no description value
  - Red: same file as T11 — new `it`; seed a fixture prompt with no
    `description`; `GET /prompts`; assert the matching entry in the JSON
    body has no `description` property (or an `undefined` value), while
    still being present with all its other fields.
  - Green: no production change expected; confirm the response already
    reflects T6/T10's `description ?? undefined` mapping end-to-end.
  - Covers: AC6 (see text above).

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
|---|---|---|
| AC1 | Given multiple prompts exist, When the user requests the list of prompts, Then the response includes every prompt, each with its id, category (id and name), title, prompt text, description, createdAt, and updatedAt. | T1, T6, T11 |
| AC2 | Given multiple prompts exist, When the user requests the list of prompts (with or without a category filter), Then the prompts are ordered from most recently created to least recently created. | T6, T11 |
| AC3 | Given no prompts exist, When the user requests the list of prompts, Then the response is an empty list, not an error. | T2, T9, T12 |
| AC4 | Given prompts exist in more than one category, When the user requests the list of prompts filtered by a category that has prompts, Then the response includes only the prompts belonging to that category. | T3, T7, T13 |
| AC5 | Given a category filter value that matches no prompt — because no such category exists, or it exists but currently has no prompts — When the user requests the list of prompts filtered by that value, Then the response is an empty list, not an error. | T8, T14 |
| AC6 | Given a prompt that was created without a description, When the user requests the list of prompts, Then that prompt is included in the response with no description value, rather than an error or being left out of the list. | T10, T15 |
