# Tasks: Get prompt by id

Plan: specs/003-get-prompt/plan.md
Status: READY FOR REVIEW

- [ ] T1. Use case returns the prompt provided by the repository, fully shaped
    - Red: `tests/unit/logic/prompt/application/GetPromptUseCase.test.ts` —
      construct `GetPromptUseCase` with a `mock<PromptRepositoryInterface>()`
      (per `testing` skill); set `repository.findById.mockResolvedValue(fixture)`
      with a fixture `Prompt` (all fields set, via faker, including nested
      `category`); call `useCase.invoke(fixture.id)`; assert the result
      equals the fixture exactly. Fails: `PromptNotFoundError`, the
      `findById` port method, and `GetPromptUseCase` do not exist yet.
    - Green: add `findById(id: string): Promise<Prompt | undefined>` to
      `src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`;
      create `src/logic/prompt/domain/errors/PromptNotFoundError.ts`; create
      `src/logic/prompt/application/GetPromptUseCase.ts` whose `invoke(id)`
      calls `this.repository.findById(id)` and returns the result when
      defined.
    - Covers: AC1 "Given a prompt exists, When the user opens it by its id,
      Then the response includes that prompt's id, category (id and name),
      title, prompt text, description, createdAt, and updatedAt."

- [ ] T2. Use case throws PromptNotFoundError when the repository finds nothing
    - Red: same file as T1 — new `it`; `repository.findById.mockResolvedValue(undefined)`;
      assert `await expect(useCase.invoke('missing-id')).rejects.toThrow(PromptNotFoundError)`
      and `.rejects.toThrow('Prompt not found: missing-id')` (asserting both
      error type and message, per `testing` skill).
    - Green: `GetPromptUseCase.invoke()` throws
      `new PromptNotFoundError(id)` when `repository.findById` resolves
      `undefined`.
    - Covers: AC3 "Given no prompt exists with the supplied id, When the
      user opens a prompt by that id, Then the user is told the prompt was
      not found (E1), and no prompt data is returned."

- [ ] T3. Use case returns a prompt with no description unchanged
    - Red: same file as T1 — new `it`; build a fixture `Prompt` with
      `description: undefined`; `repository.findById.mockResolvedValue(fixture)`;
      call `useCase.invoke(fixture.id)`; assert the result's `description`
      is `undefined`.
    - Green: no production change expected if T1's `invoke()` simply
      returns the repository's result unchanged; run the test to confirm.
    - Covers: AC2 "Given a prompt exists with no description, When the user
      opens it by its id, Then the response includes that prompt with no
      description value, rather than an error."

- [ ] T4. Repository returns a prompt joined with its category by id
    - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` —
      new `describe('findById', ...)` block; per `testing` skill integration
      conventions, insert a fixture category via
      `tests/lib/seeding/promptCategories.ts`; insert a fixture prompt (all
      fields set, including `description`) referencing that category via
      `tests/lib/seeding/prompts.ts`; call
      `new DrizzlePromptRepository(db).findById(fixture.id)`; assert the
      result equals `{ id, category: { id, name }, title, prompt,
      description, createdAt, updatedAt }` with correct values; delete the
      inserted rows in `afterEach`. Fails: `findById` does not exist yet.
    - Green: implement `DrizzlePromptRepository.findById()` joining
      `prompts` to `prompt_categories`, filtering by
      `eq(sql`${prompts.id}::text`, id)`, `.limit(1)`, mapping the row like
      `findAll` does (per plan.md §7).
    - Covers: AC1 (see T1 text above).

- [ ] T5. Repository returns undefined when no prompt matches the id
    - Red: same file as T4 — new `it`; call
      `findById(faker.string.uuid())` with an id that matches no inserted
      prompt; assert the result is `undefined`.
    - Green: no production change expected; T4's query naturally returns no
      rows for a non-matching id, and `findById` maps that to `undefined`.
      Run the test to confirm.
    - Covers: AC3 (see T2 text above).

- [ ] T6. Repository returns undefined when the id is not UUID-shaped
    - Red: same file as T4 — new `it`; call `findById('not-a-uuid')`;
      assert the result is `undefined` (not a thrown database error).
    - Green: no production change expected if T4's `::text` cast is already
      in place; run the test to confirm it doesn't throw.
    - Covers: AC3 (see T2 text above); plan.md §9 Assumption 1 (malformed
      id treated as not-found).

- [ ] T7. Repository represents a prompt with no description as an absent value
    - Red: same file as T4 — new `it`; insert a fixture prompt with no
      `description` (via the seeding helper, omitting the field); call
      `findById(fixture.id)`; assert the result's `description` is
      `undefined` (not `null`).
    - Green: no production change expected if T4's `description ?? undefined`
      mapping is already in place; run the test to confirm.
    - Covers: AC2 (see T3 text above).

- [ ] T8. `GET /prompts/:id` returns the full prompt when it exists
    - Red: `tests/integration/app.test.ts` — new `describe('GET /prompts/:id', ...)`
      block; using `supertest` against the real Express `app`, seed a
      fixture category and a fixture prompt referencing it (via the
      seeding helpers); `GET /prompts/<fixture.id>`; assert status `200`
      and the JSON body equals
      `{ id, category: { id, name }, title, prompt, description, createdAt, updatedAt }`;
      clean up the inserted fixture rows afterward. Fails: no
      `GET /prompts/:id` route, handler, use-case wiring, or params schema
      exists yet.
    - Green: create `src/handlers/schemas/GetPromptParamsSchema.ts`
      (`z.object({ id: z.string() })`); create
      `src/handlers/GetPromptHandler.ts` that parses `req.params` with
      `GetPromptParamsSchema`, calls
      `getPromptUseCase.invoke(id)` inside a `try/catch`, and responds
      `200` with the JSON prompt on success; add
      `getPromptUseCase = new GetPromptUseCase(promptRepository)` to
      `src/logic/prompt/services.ts`; register
      `app.get('/prompts/:id', getPromptHandler)` in `src/app.ts`.
    - Covers: AC1 (see T1 text above).

- [ ] T9. `GET /prompts/:id` returns 404 when the id matches no prompt
    - Red: same file as T8 — new `it`; `GET /prompts/<faker.string.uuid() that matches nothing>`;
      assert status `404` and the JSON body contains an `error` message.
    - Green: `GetPromptHandler.ts`'s `catch` block catches
      `PromptNotFoundError` specifically and responds
      `res.status(404).json({ error: err.message })`; any other error is
      re-thrown, not swallowed (plan.md §5, §9 Assumption 3).
    - Covers: AC3 (see T2 text above).

- [ ] T10. `GET /prompts/:id` returns 404 when the id is not UUID-shaped
    - Red: same file as T8 — new `it`; `GET /prompts/not-a-uuid`; assert
      status `404` (not `400` or `500`).
    - Green: no production change expected if T9's handling and T6's
      repository cast are already in place; run the test to confirm.
    - Covers: AC3 (see T2 text above); plan.md §9 Assumption 1.

- [ ] T11. `GET /prompts/:id` includes a prompt with no description, with no description value
    - Red: same file as T8 — new `it`; seed a fixture prompt with no
      `description`; `GET /prompts/<fixture.id>`; assert status `200` and
      the response body has no `description` property (or an `undefined`
      value), with all other fields present.
    - Green: no production change expected; confirm the response already
      reflects T7's `description ?? undefined` mapping end-to-end.
    - Covers: AC2 (see T3 text above).

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | ----------------------------------------- | -------------------- |
| AC1 | Given a prompt exists, When the user opens it by its id, Then the response includes that prompt's id, category (id and name), title, prompt text, description, createdAt, and updatedAt. | T1, T4, T8 |
| AC2 | Given a prompt exists with no description, When the user opens it by its id, Then the response includes that prompt with no description value, rather than an error. | T3, T7, T11 |
| AC3 | Given no prompt exists with the supplied id, When the user opens a prompt by that id, Then the user is told the prompt was not found (E1), and no prompt data is returned. | T2, T5, T6, T9, T10 |
