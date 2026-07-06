# Tasks: Update prompt

Plan: specs/006-update-prompt/plan.md

- [x] T1. Use case updates and returns the assembled prompt when the prompt and category both exist
    - Red: `tests/unit/logic/prompt/application/UpdatePromptUseCase.test.ts` —
      construct `UpdatePromptUseCase` with `mock<PromptRepositoryInterface>()`
      and `mock<PromptCategoryRepositoryInterface>()` (per `testing` skill);
      build an existing `Prompt` fixture via `promptModelFactory`/a local
      `buildPrompt` helper (with a fixed `createdAt` in the past); set
      `promptRepository.findById.mockResolvedValue(existingPrompt)`,
      `categoryRepository.findById.mockResolvedValue(fixtureCategory)`
      (via `promptCategoryModelFactory.create()`), and
      `promptRepository.update.mockResolvedValue(undefined)`; build an
      `UpdatePromptQuery` fixture (`id: existingPrompt.id`,
      `categoryId: fixtureCategory.id`, a new `title`/`prompt`/`description`,
      a fresh `updatedAt`); call `useCase.invoke(query)`; assert the result
      equals
      `{ id: query.id, category: fixtureCategory, title: query.title, prompt: query.prompt, description: query.description, createdAt: existingPrompt.createdAt, updatedAt: query.updatedAt }`
      (asserting `createdAt` is preserved from the existing prompt, not from
      the query); assert `promptRepository.update` was called once with
      `(query.id, { categoryId: query.categoryId, title: query.title, prompt: query.prompt, description: query.description ?? null, updatedAt: query.updatedAt })`.
      Fails: `UpdatePromptQuery`, `UpdatePromptUseCase`, `UpdatePrompt`, and
      `PromptRepositoryInterface.update` do not exist yet.
    - Green: add the `UpdatePrompt` interface to
      `src/logic/prompt/domain/Prompt.ts` and add
      `update(id: string, prompt: UpdatePrompt): Promise<void>` to
      `PromptRepositoryInterface`; create
      `src/logic/prompt/application/UpdatePromptUseCase.ts` per plan.md §4,
      looking up the existing prompt and the category, building an
      `UpdatePrompt` from the query (mapping `description ?? null`), calling
      `promptRepository.update(query.id, updatePrompt)`, and returning the
      full assembled `Prompt` (preserving `createdAt`).
    - Covers: AC1 "Given an existing prompt, a title, prompt text, an
      existing category, and a description are supplied, When the user
      updates the prompt, Then the prompt's title, prompt text, category,
      and description are replaced with the supplied values, its id and
      creation time remain unchanged, its last-updated time is refreshed,
      and the response includes the updated id, category (id and name),
      title, prompt text, description, createdAt, and updatedAt."

- [x] T2. Use case throws PromptNotFoundError and does not look up the category or persist when the prompt does not exist
    - Red: same file as T1 — new `it`;
      `promptRepository.findById.mockResolvedValue(undefined)`; call
      `useCase.invoke(query)`; assert
      `await expect(useCase.invoke(query)).rejects.toThrow(PromptNotFoundError)`
      and `.rejects.toThrow('Prompt not found: ' + query.id)` (asserting
      both error type and message, per `testing` skill); assert
      `categoryRepository.findById` was never called and
      `promptRepository.update` was never called.
    - Green: `UpdatePromptUseCase.invoke()` throws
      `new PromptNotFoundError(query.id)` immediately after
      `promptRepository.findById` resolves `undefined`, before calling
      `categoryRepository.findById` or `promptRepository.update`.
    - Covers: AC10 "Given no prompt exists with the supplied id, When the
      user attempts to update a prompt, Then the user is told the prompt was
      not found (E1), and no changes are made to any prompt."; AC11 "Given
      no prompt exists with the supplied id, and the supplied category
      reference is also invalid, When the user attempts to update the
      prompt, Then the user is told only that the prompt was not found (E1),
      not that the category is invalid."

- [x] T3. Use case throws CategoryNotFoundError and does not persist when the prompt exists but the category does not
    - Red: same file as T1 — new `it`;
      `promptRepository.findById.mockResolvedValue(existingPrompt)`;
      `categoryRepository.findById.mockResolvedValue(undefined)`; call
      `useCase.invoke(query)`; assert
      `await expect(useCase.invoke(query)).rejects.toThrow(CategoryNotFoundError)`
      and `.rejects.toThrow('Category not found: ' + query.categoryId)`;
      assert `promptRepository.update` was never called.
    - Green: `UpdatePromptUseCase.invoke()` throws
      `new CategoryNotFoundError(query.categoryId)` when
      `categoryRepository.findById` resolves `undefined`, after the prompt
      existence check has already passed.
    - Covers: AC9 "Given the category reference is validly shaped but does
      not correspond to any existing category, When the user attempts to
      update the prompt, Then the user is told the category is invalid
      (E2), and no changes are made to the prompt."

- [x] T4. Use case updates a prompt to have no description when the supplied description is absent
    - Red: same file as T1 — new `it`; build an `UpdatePromptQuery` fixture
      with `description: undefined`;
      `promptRepository.findById.mockResolvedValue(existingPrompt)` (with a
      defined `description`); `categoryRepository.findById.mockResolvedValue(fixtureCategory)`;
      call `useCase.invoke(query)`; assert the result's `description` is
      `undefined`.
    - Green: no production change expected if T1's `invoke()` simply passes
      `query.description` through unchanged; run the test to confirm.
    - Covers: AC2 "Given the description is supplied with no value, When the
      user updates the prompt, Then the prompt is updated to have no
      description, rather than an error."

- [x] T5. Use case updates a prompt to have an empty-text description, distinct from no description
    - Red: same file as T1 — new `it`; build an `UpdatePromptQuery` fixture
      with `description: ''`; set up mocks as in T1; call
      `useCase.invoke(query)`; assert the result's `description` is `''`
      (strictly, not `undefined` and not `null`).
    - Green: no production change expected; confirms T1's pass-through
      preserves an empty string distinctly from `undefined`.
    - Covers: AC3 "Given the description is supplied as empty text, When the
      user updates the prompt, Then the prompt is updated to have that
      empty text as its description, distinct from having no description at
      all."

- [x] T6. Prompt repository persists updated fields for an existing prompt row
    - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` —
      new `describe('update', ...)` block; insert two fixture categories and
      an existing fixture prompt (via
      `insertPromptCategories`/`insertPrompts`) referencing the first
      category; build an `UpdatePrompt` fixture (new `title`/`prompt`/
      `description`, `categoryId` pointing at the second fixture category,
      and a new `updatedAt`); call
      `new DrizzlePromptRepository(db).update(existingPrompt.id, updatePrompt)`;
      then call `repository.findById(existingPrompt.id)` and assert it
      equals the expected updated `Prompt` (the original `createdAt`
      preserved, and the new `category`/`title`/`prompt`/`description`/
      `updatedAt`); delete the inserted rows in `afterAll`/`afterEach`.
      Fails: `update` and `UpdatePrompt` do not exist yet.
    - Green: implement `DrizzlePromptRepository.update(id, prompt)` per
      plan.md §7, conditionally including `title`, `promptCategoryId`
      (from `prompt.categoryId`), `prompt`, and `description` in the
      `.set({...})` call only when each is defined on the `UpdatePrompt`
      argument, always including `updatedAt`, via
      `db.update(prompts).set({...}).where(eq(prompts.id, id))`, excluding
      `id` and `createdAt` entirely (no `UpdatePrompt` field exists for
      either).
    - Covers: AC1 (see T1 text above).

- [x] T7. Prompt repository persists an updated prompt with no description as an absent value
    - Red: same file as T6 — new `it`; insert an existing fixture prompt
      with a defined `description`; build an `UpdatePrompt` fixture with
      `description: null`; call
      `repository.update(existingPrompt.id, updatePrompt)`; call
      `repository.findById(existingPrompt.id)`; assert the result's
      `description` is `undefined` (not `null`, not an empty string).
    - Green: no production change expected if T6's conditional-write mapping
      is already in place; run the test to confirm (relies on `findById`'s
      existing `description ?? undefined` read-side mapping).
    - Covers: AC2 (see T4 text above).

- [x] T8. `PUT /prompts/:id` updates and returns the prompt
    - Red: `tests/integration/handlers/UpdatePromptHandler.test.ts` — new
      top-level `describe('PUT /prompts/:id', ...)`; seed two fixture
      categories and one fixture prompt (referencing the first category) via
      the seeding helpers; using `supertest` against the real Express `app`,
      `PUT /prompts/:id` (with the fixture prompt's id) sending
      `{ title, prompt, description, category_id: secondFixtureCategory.id }`;
      assert status `200` and the JSON body matches
      `{ id: fixturePrompt.id, category: { id: secondFixtureCategory.id, name: secondFixtureCategory.name }, title, prompt, description }`,
      `createdAt` equals the original fixture prompt's `createdAt`, and
      `updatedAt` differs from it; clean up the inserted rows afterward.
      Fails: no `PUT /prompts/:id` route, handler, use-case wiring, or
      schema exists yet.
    - Green: create `src/schemas/UpdatePromptSchema.ts` per plan.md §6;
      create `src/handlers/UpdatePromptHandler.ts` that reads
      `req.parsedRequest?.params`/`?.body`, generates `updatedAt` via
      `new Date()`, calls `updatePromptUseCase.invoke(...)` inside a
      `try/catch`, and responds `200` with the JSON prompt on success; add
      `updatePromptUseCase = new UpdatePromptUseCase(promptRepository, promptCategoryRepository)`
      to `src/logic/prompt/services.ts`; register
      `app.put('/prompts/:id', validateRequestMiddleware(UpdatePromptSchema), updatePromptHandler)`
      in `src/app.ts`.
    - Covers: AC1 (see T1 text above).

- [x] T9. `PUT /prompts/:id` clears the description when its value is supplied as null
    - Red: same file as T8 — new `it`; seed a fixture prompt with a defined
      `description`; `PUT /prompts/:id` with
      `{ title, prompt, category_id: fixtureCategory.id, description: null }`;
      assert status `200` and the response body has no `description`
      property (or an `undefined` value); clean up afterward.
    - Green: no production change expected; confirms T4/T7's absent-value
      mapping end-to-end through `UpdatePromptSchema.body.description: z.string().nullable()`.
    - Covers: AC2 (see T4 text above).

- [x] T10. `PUT /prompts/:id` sets the description to empty text, distinct from clearing it
    - Red: same file as T8 — new `it`; `PUT /prompts/:id` with
      `{ title, prompt, category_id: fixtureCategory.id, description: '' }`;
      assert status `200` and the response body's `description` is `''`
      (present, not omitted); clean up afterward.
    - Green: no production change expected; confirms T5's pass-through
      end-to-end.
    - Covers: AC3 (see T5 text above).

- [x] T11. `PUT /prompts/:id` Request Validation — returns missing-field errors for an empty body
    - Red: same file as T8 — nested `describe('Request Validation', ...)`
      per `testing` skill's Request Validation convention; `PUT /prompts/:id`
      (with a fixture prompt's id) sending `{}`; assert status `400` and the
      body's `errors` array contains exactly
      `{ field: 'body.title', error: 'Missing required value' }`,
      `{ field: 'body.prompt', error: 'Missing required value' }`,
      `{ field: 'body.category_id', error: 'Missing required value' }`, and
      `{ field: 'body.description', error: 'Invalid input: expected string, received undefined' }`
      or the exact Zod-produced message for a missing `.nullable()` string
      field (assert the literal message the schema actually produces, per
      `testing` skill — not `objectContaining`).
    - Green: none beyond T8 — `UpdatePromptSchema.body`'s `z.object` already
      reports all four missing/invalid required fields together via the
      existing `validateRequestMiddleware` mechanism
      (`004-request-validation-middleware`).
    - Covers: AC4 "Given the description field is missing from the request
      entirely, When the user attempts to update the prompt, Then the user
      is told the description is missing (V4), and no changes are made to
      the prompt."; AC5 "Given the title is missing or blank, When the user
      attempts to update the prompt, Then the user is told the title is
      missing (V1), and no changes are made to the prompt."; AC6 "Given the
      prompt text is missing or blank, When the user attempts to update the
      prompt, Then the user is told the prompt text is missing (V2), and no
      changes are made to the prompt."; AC7 "Given the category reference is
      missing or not shaped like a valid category identifier, When the user
      attempts to update the prompt, Then the user is told the category
      reference is invalid (V3), and no changes are made to the prompt.";
      AC8 "Given more than one of title, prompt text, category reference,
      and description are missing or invalid at once, When the user
      attempts to update the prompt, Then the user is told about every one
      of those problems together (V1/V2/V3/V4), not only the first one
      found, and no changes are made to the prompt."

- [x] T12. `PUT /prompts/:id` Request Validation — returns an invalid-value error for a non-UUID category_id
    - Red: same file as T8, inside the `Request Validation` describe — new
      `it`; `PUT /prompts/:id` with
      `{ title: 'title', prompt: 'prompt', category_id: '12345', description: null }`;
      assert status `400` and the body's `errors` array contains exactly
      `{ field: 'body.category_id', error: 'Invalid UUID value' }`.
    - Green: none beyond T8 — `UpdatePromptSchema.body.category_id: z.string().uuid('Invalid UUID value')`
      already rejects a non-UUID-shaped value.
    - Covers: AC7 (see T11 text above).

- [x] T13. `PUT /prompts/:id` returns a not-found error when the path id matches no prompt
    - Red: same file as T8 — new `it` (outside `Request Validation`, since
      this is a resource-existence failure, not a shape failure); `PUT
      /prompts/:id` with a random `id` (`faker.string.uuid()`) that matches
      no seeded prompt, sending a fully valid body referencing an existing
      category; assert status `404` and the JSON body equals
      `{ error: 'Prompt not found: <that id>' }`.
    - Green: `UpdatePromptHandler.ts`'s `catch` block catches
      `PromptNotFoundError` specifically and responds
      `res.status(404).json({ error: err.message })` (plan.md §5).
    - Covers: AC10 (see T2 text above).

- [x] T14. `PUT /prompts/:id` returns a category-invalid error when category_id matches no category
    - Red: same file as T8 — new `it`; seed an existing fixture prompt; `PUT
      /prompts/:id` (with the fixture prompt's id) sending a body with a
      UUID-shaped but non-existent `category_id` (`faker.string.uuid()`);
      assert status `400` and the JSON body equals
      `{ error: 'Category not found: <that id>' }`; assert (via
      `repository.findById`) the fixture prompt's stored fields are
      unchanged.
    - Green: `UpdatePromptHandler.ts`'s `catch` block catches
      `CategoryNotFoundError` specifically and responds
      `res.status(400).json({ error: err.message })`; any other error is
      re-thrown, not swallowed (plan.md §5).
    - Covers: AC9 (see T3 text above).

- [x] T15. `PUT /prompts/:id` returns only the not-found error when both the path id and the category_id are invalid
    - Red: same file as T8 — new `it`; `PUT /prompts/:id` with a random `id`
      that matches no seeded prompt (`faker.string.uuid()`) AND a body whose
      `category_id` is also a random, non-existent UUID; assert status
      `404` (not `400`) and the JSON body equals
      `{ error: 'Prompt not found: <the path id>' }`, never a
      category-invalid message.
    - Green: none beyond T2/T13 — `UpdatePromptUseCase.invoke()` already
      checks the prompt's existence before the category's, so this case is
      already handled correctly end-to-end; run the test to confirm.
    - Covers: AC11 "Given no prompt exists with the supplied id, and the
      supplied category reference is also invalid, When the user attempts
      to update the prompt, Then the user is told only that the prompt was
      not found (E1), not that the category is invalid."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | ----------------------------------------- | -------------------- |
| AC1 | Given an existing prompt, a title, prompt text, an existing category, and a description are supplied, When the user updates the prompt, Then the prompt's title, prompt text, category, and description are replaced with the supplied values, its id and creation time remain unchanged, its last-updated time is refreshed, and the response includes the updated id, category (id and name), title, prompt text, description, createdAt, and updatedAt. | T1, T6, T8 |
| AC2 | Given the description is supplied with no value, When the user updates the prompt, Then the prompt is updated to have no description, rather than an error. | T4, T7, T9 |
| AC3 | Given the description is supplied as empty text, When the user updates the prompt, Then the prompt is updated to have that empty text as its description, distinct from having no description at all. | T5, T10 |
| AC4 | Given the description field is missing from the request entirely, When the user attempts to update the prompt, Then the user is told the description is missing (V4), and no changes are made to the prompt. | T11 |
| AC5 | Given the title is missing or blank, When the user attempts to update the prompt, Then the user is told the title is missing (V1), and no changes are made to the prompt. | T11 |
| AC6 | Given the prompt text is missing or blank, When the user attempts to update the prompt, Then the user is told the prompt text is missing (V2), and no changes are made to the prompt. | T11 |
| AC7 | Given the category reference is missing or not shaped like a valid category identifier, When the user attempts to update the prompt, Then the user is told the category reference is invalid (V3), and no changes are made to the prompt. | T11, T12 |
| AC8 | Given more than one of title, prompt text, category reference, and description are missing or invalid at once, When the user attempts to update the prompt, Then the user is told about every one of those problems together (V1/V2/V3/V4), not only the first one found, and no changes are made to the prompt. | T11 |
| AC9 | Given the category reference is validly shaped but does not correspond to any existing category, When the user attempts to update the prompt, Then the user is told the category is invalid (E2), and no changes are made to the prompt. | T3, T14 |
| AC10 | Given no prompt exists with the supplied id, When the user attempts to update a prompt, Then the user is told the prompt was not found (E1), and no changes are made to any prompt. | T2, T13 |
| AC11 | Given no prompt exists with the supplied id, and the supplied category reference is also invalid, When the user attempts to update the prompt, Then the user is told only that the prompt was not found (E1), not that the category is invalid. | T2, T15 |
