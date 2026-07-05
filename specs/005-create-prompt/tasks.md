# Tasks: Create prompt

Plan: specs/005-create-prompt/plan.md

- [ ] T1. Use case creates and returns the assembled prompt when the category exists
    - Red: `tests/unit/logic/prompt/application/CreatePromptUseCase.test.ts` —
      construct `CreatePromptUseCase` with `mock<PromptRepositoryInterface>()`
      and `mock<PromptCategoryRepositoryInterface>()` (per `testing` skill);
      set `categoryRepository.findById.mockResolvedValue(fixtureCategory)`
      (via `promptCategoryModelFactory.create()`) and
      `promptRepository.create.mockResolvedValue(undefined)`; build a
      `CreatePromptQuery` fixture (all fields set, via faker/model factories,
      `categoryId: fixtureCategory.id`); call `useCase.invoke(query)`; assert
      the result equals
      `{ id: query.id, category: fixtureCategory, title: query.title, prompt: query.prompt, description: query.description, createdAt: query.createdAt, updatedAt: query.updatedAt }`;
      assert `promptRepository.create` was called once with that same object.
      Fails: `CreatePromptQuery`, `CreatePromptUseCase`, and the ports'
      `findById`/`create` methods do not exist yet.
    - Green: add `findById(id: string): Promise<PromptCategory | undefined>`
      to `PromptCategoryRepositoryInterface`; add
      `create(prompt: Prompt): Promise<void>` to `PromptRepositoryInterface`;
      create `src/logic/prompt/application/CreatePromptUseCase.ts` per
      plan.md §4, assembling the `Prompt` from the query and the looked-up
      category, calling `promptRepository.create`, and returning the
      assembled prompt.
    - Covers: AC1 "Given a title, prompt text, and an existing category are
      supplied, When the user creates a prompt, Then a new prompt is created
      and the response includes its id, category (id and name), title,
      prompt text, description, createdAt, and updatedAt."

- [ ] T2. Use case throws CategoryNotFoundError and does not persist when the category does not exist
    - Red: same file as T1 — new `it`;
      `categoryRepository.findById.mockResolvedValue(undefined)`; call
      `useCase.invoke(query)`; assert
      `await expect(useCase.invoke(query)).rejects.toThrow(CategoryNotFoundError)`
      and `.rejects.toThrow('Category not found: ' + query.categoryId)`
      (asserting both error type and message, per `testing` skill); assert
      `promptRepository.create` was never called.
    - Green: create `src/logic/prompt/domain/errors/CategoryNotFoundError.ts`
      per plan.md §2; `CreatePromptUseCase.invoke()` throws
      `new CategoryNotFoundError(query.categoryId)` before calling
      `promptRepository.create` when `categoryRepository.findById` resolves
      `undefined`.
    - Covers: AC6 "Given the category reference is validly shaped but does
      not correspond to any existing category, When the user attempts to
      create a prompt, Then the user is told the category is invalid (E1),
      and no prompt is created."

- [ ] T3. Use case creates a prompt with no description unchanged
    - Red: same file as T1 — new `it`; build a `CreatePromptQuery` fixture
      with `description: undefined`; `categoryRepository.findById.mockResolvedValue(fixtureCategory)`;
      call `useCase.invoke(query)`; assert the result's `description` is
      `undefined`.
    - Green: no production change expected if T1's `invoke()` simply passes
      `query.description` through unchanged; run the test to confirm.
    - Covers: AC2 "Given no description is supplied, When the user creates a
      prompt, Then the prompt is created and returned with no description
      value, rather than an error."

- [ ] T4. Category repository returns the matching category by id
    - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.test.ts` —
      new `describe('findById', ...)` block; per `testing` skill integration
      conventions, insert a fixture category via
      `tests/lib/seeding/promptCategories.ts`; call
      `new DrizzlePromptCategoryRepository(db).findById(fixture.id)`; assert
      the result equals `{ id, name }` with correct values; delete the
      inserted row in `afterEach`/`afterAll` as in the existing `findAll`
      block. Fails: `findById` does not exist yet.
    - Green: implement `DrizzlePromptCategoryRepository.findById()` per
      plan.md §7, filtering by `eq(sql`${promptCategories.id}::text`, id)`,
      `.limit(1)`.
    - Covers: AC1 (see T1 text above).

- [ ] T5. Category repository returns undefined when no category matches the id
    - Red: same file as T4 — new `it`; call
      `findById(faker.string.uuid())` with an id that matches no inserted
      category; assert the result is `undefined`.
    - Green: no production change expected; T4's query naturally returns no
      rows for a non-matching id. Run the test to confirm.
    - Covers: AC6 (see T2 text above).

- [ ] T6. Category repository returns undefined when the id is not UUID-shaped
    - Red: same file as T4 — new `it`; call `findById('not-a-uuid')`; assert
      the result is `undefined` (not a thrown database error).
    - Green: no production change expected if T4's `::text` cast is already
      in place; run the test to confirm it doesn't throw.
    - Covers: AC6 (see T2 text above); plan.md §7 note (safe for any string).

- [ ] T7. Prompt repository persists a new prompt row
    - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` —
      new `describe('create', ...)` block; insert a fixture category via
      the seeding helper; build a full `Prompt` fixture (via
      `promptModelFactory`/`promptCategoryModelFactory`, all fields set,
      referencing the fixture category); call
      `new DrizzlePromptRepository(db).create(fixture)`; then call
      `repository.findById(fixture.id)` and assert it equals the fixture;
      delete the inserted prompt row in `afterEach`. Fails: `create` does not
      exist yet.
    - Green: implement `DrizzlePromptRepository.create()` per plan.md §7,
      inserting into `prompts` via `db.insert(prompts).values({...})` mapping
      `prompt.category.id` to `promptCategoryId` and
      `prompt.description ?? null` to `description`.
    - Covers: AC1 (see T1 text above).

- [ ] T8. Prompt repository persists a prompt with no description as an absent value
    - Red: same file as T7 — new `it`; build a `Prompt` fixture with
      `description: undefined`; call `repository.create(fixture)`; call
      `repository.findById(fixture.id)`; assert the result's `description`
      is `undefined` (not `null`, not an empty string).
    - Green: no production change expected if T7's
      `description ?? null` mapping is already in place; run the test to
      confirm (relies on `findById`'s existing `description ?? undefined`
      read-side mapping).
    - Covers: AC2 (see T3 text above).

- [ ] T9. `POST /prompts` creates and returns the new prompt
    - Red: `tests/integration/handlers/CreatePromptHandler.test.ts` — new
      top-level `describe('POST /prompts', ...)`; seed a fixture category via
      the seeding helper; using `supertest` against the real Express `app`,
      `POST /prompts` with
      `{ title, prompt, description, category_id: fixtureCategory.id }`;
      assert status `201` and the JSON body has a defined `id`, matches
      `{ category: { id: fixtureCategory.id, name: fixtureCategory.name }, title, prompt, description }`,
      and `createdAt === updatedAt`; clean up the created prompt row
      afterward using `response.body.id` with `deletePromptsByIds`. Fails: no
      `POST /prompts` route, handler, use-case wiring, or schema exists yet.
    - Green: create `src/schemas/CreatePromptSchema.ts` per plan.md §6;
      create `src/handlers/CreatePromptHandler.ts` that reads
      `req.parsedRequest?.body`, generates `id` via `randomUUID()` and
      `createdAt`/`updatedAt` via a single `new Date()` call, calls
      `createPromptUseCase.invoke(...)` inside a `try/catch`, and responds
      `201` with the JSON prompt on success; add
      `createPromptUseCase = new CreatePromptUseCase(promptRepository, promptCategoryRepository)`
      to `src/logic/prompt/services.ts`; register
      `app.post('/prompts', validateRequestMiddleware(CreatePromptSchema), createPromptHandler)`
      in `src/app.ts`.
    - Covers: AC1 (see T1 text above).

- [ ] T10. `POST /prompts` creates a prompt without a description
    - Red: same file as T9 — new `it`; `POST /prompts` with
      `{ title, prompt, category_id: fixtureCategory.id }` (no
      `description`); assert status `201` and the response body has no
      `description` property (or an `undefined` value), with all other
      fields present; clean up the created prompt row afterward.
    - Green: no production change expected; confirm the response already
      reflects T3/T8's absent-description mapping end-to-end.
    - Covers: AC2 (see T3 text above).

- [ ] T11. `POST /prompts` Request Validation — returns missing-field errors for an empty body
    - Red: same file as T9 — nested `describe('Request Validation', ...)`
      per `testing` skill's Request Validation convention; `POST /prompts`
      with `{}`; assert status `400` and the body's `errors` array contains
      exactly `{ field: 'body.title', error: 'Required' }`,
      `{ field: 'body.prompt', error: 'Required' }', and
      `{ field: 'body.category_id', error: 'Required' }` (exact object
      literals, per `testing` skill — not `objectContaining`). Fails: no
      route/schema exists yet (same underlying cause as T9; this task's Red
      step targets the combined-errors behavior specifically once T9's Green
      step exists).
    - Green: none beyond T9 — `CreatePromptSchema.body`'s `z.object` already
      reports all three missing required fields together via the existing
      `validateRequestMiddleware` mechanism (`004-request-validation-middleware`).
    - Covers: AC3 "Given the title is missing or blank... the user is told
      the title is missing (V1)..."; AC4 "Given the prompt text is missing
      or blank... the user is told the prompt text is missing (V2)...";
      AC5 "Given the category reference is missing or not shaped like a
      valid category identifier... the user is told the category reference
      is invalid (V3)..."; AC7 "Given more than one of title, prompt text,
      and category reference are missing or invalid at once... the user is
      told about every one of those problems together..., not only the
      first one found, and no prompt is created."

- [ ] T12. `POST /prompts` Request Validation — returns an invalid-value error for a non-UUID category_id
    - Red: same file as T9, inside the `Request Validation` describe — new
      `it`; `POST /prompts` with
      `{ title: 'title', prompt: 'prompt', category_id: '12345' }`; assert
      status `400` and the body's `errors` array contains exactly
      `{ field: 'body.category_id', error: 'Invalid uuid' }`.
    - Green: none beyond T9 — `CreatePromptSchema.body.category_id: z.string().uuid()`
      already rejects a non-UUID-shaped value.
    - Covers: AC5 (see T11 text above).

- [ ] T13. `POST /prompts` returns a category-invalid error when category_id matches no category
    - Red: same file as T9 — new `it` (outside `Request Validation`, since
      this is a business-rule failure, not a shape failure); `POST /prompts`
      with a UUID-shaped but non-existent `category_id`
      (`faker.string.uuid()`); assert status `400` and the JSON body equals
      `{ error: 'Category not found: <that id>' }`; assert no prompt row was
      created (e.g. no cleanup needed / a follow-up `findById` on any
      generated id is not applicable since none exists).
    - Green: `CreatePromptHandler.ts`'s `catch` block catches
      `CategoryNotFoundError` specifically and responds
      `res.status(400).json({ error: err.message })`; any other error is
      re-thrown, not swallowed (plan.md §5).
    - Covers: AC6 (see T2 text above).

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | ----------------------------------------- | -------------------- |
| AC1 | Given a title, prompt text, and an existing category are supplied, When the user creates a prompt, Then a new prompt is created and the response includes its id, category (id and name), title, prompt text, description, createdAt, and updatedAt. | T1, T4, T7, T9 |
| AC2 | Given no description is supplied, When the user creates a prompt, Then the prompt is created and returned with no description value, rather than an error. | T3, T8, T10 |
| AC3 | Given the title is missing or blank, When the user attempts to create a prompt, Then the user is told the title is missing (V1), and no prompt is created. | T11 |
| AC4 | Given the prompt text is missing or blank, When the user attempts to create a prompt, Then the user is told the prompt text is missing (V2), and no prompt is created. | T11 |
| AC5 | Given the category reference is missing or not shaped like a valid category identifier, When the user attempts to create a prompt, Then the user is told the category reference is invalid (V3), and no prompt is created. | T11, T12 |
| AC6 | Given the category reference is validly shaped but does not correspond to any existing category, When the user attempts to create a prompt, Then the user is told the category is invalid (E1), and no prompt is created. | T2, T5, T6, T13 |
| AC7 | Given more than one of title, prompt text, and category reference are missing or invalid at once, When the user attempts to create a prompt, Then the user is told about every one of those problems together (V1/V2/V3), not only the first one found, and no prompt is created. | T11 |
