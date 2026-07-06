# Tasks: Delete prompt

Plan: specs/007-delete-prompt/plan.md

- [x] T1. Use case removes the prompt when it exists
    - Red: `tests/unit/logic/prompt/application/DeletePromptUseCase.test.ts` —
      construct `DeletePromptUseCase` with `mock<PromptRepositoryInterface>()`
      (per `testing` skill); build an existing `Prompt` fixture via a local
      `buildPrompt` helper wrapping `promptModelFactory`/`promptCategoryModelFactory`
      (mirrors `UpdatePromptUseCase.test.ts`'s helper); set
      `promptRepository.findById.mockResolvedValue(existingPrompt)` and
      `promptRepository.delete.mockResolvedValue(undefined)`; call
      `useCase.invoke({ id: existingPrompt.id })`; assert the call resolves
      (`undefined`); assert `promptRepository.delete` was called once with
      `existingPrompt.id`. Fails: `DeletePromptQuery`, `DeletePromptUseCase`,
      and `PromptRepositoryInterface.delete` do not exist yet.
    - Green: add `delete(id: string): Promise<void>` to
      `PromptRepositoryInterface`
      (`src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`);
      create `src/logic/prompt/application/DeletePromptUseCase.ts` per
      plan.md §4, looking up the prompt via `findById` and calling
      `promptRepository.delete(query.id)` when found.
    - Covers: AC1 "Given an existing prompt, When the user deletes it by its
      id, Then the prompt is permanently removed and the user is told the
      removal succeeded."

- [x] T2. Use case throws PromptNotFoundError and does not delete when the prompt does not exist
    - Red: same file as T1 — new `it`;
      `promptRepository.findById.mockResolvedValue(undefined)`; call
      `useCase.invoke({ id })`; assert
      `await expect(useCase.invoke({ id })).rejects.toThrow(PromptNotFoundError)`
      and `.rejects.toThrow('Prompt not found: ' + id)` (asserting both error
      type and message, per `testing` skill); assert `promptRepository.delete`
      was never called.
    - Green: `DeletePromptUseCase.invoke()` throws
      `new PromptNotFoundError(query.id)` immediately after
      `promptRepository.findById` resolves `undefined`, before calling
      `promptRepository.delete`.
    - Covers: AC4 "Given no prompt exists with the supplied id, When the user
      attempts to delete it, Then the user is told the prompt was not found
      (E1), and no prompt is removed."

- [x] T3. Prompt repository removes an existing prompt row
    - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` —
      new `describe('delete', ...)` block; insert a fixture category and an
      existing fixture prompt (via `insertPromptCategories`/`insertPrompts`);
      call `new DrizzlePromptRepository(db).delete(existingPrompt.id)`; then
      call `repository.findById(existingPrompt.id)` and assert it resolves
      `undefined`; delete the fixture category in `afterAll` (the prompt row
      is already gone, so no prompt cleanup is needed for this case). Fails:
      `delete` does not exist yet on `DrizzlePromptRepository`.
    - Green: implement `DrizzlePromptRepository.delete(id)` per plan.md §7:
      `await this.db.delete(prompts).where(eq(prompts.id, id));`.
    - Covers: AC1 (see T1 text above); AC2 "Given a prompt that was just
      deleted, When the user looks it up individually afterward, Then the
      prompt is not found, as if it never existed." (via the repository's
      own `findById` after `delete`).

- [x] T4. `DELETE /prompts/:id` removes the prompt and responds with no content
    - Red: `tests/integration/handlers/DeletePromptHandler.test.ts` — new
      top-level `describe('DELETE /prompts/:id', ...)`; seed a fixture
      category and a fixture prompt via the seeding helpers; using
      `supertest` against the real Express `app`, `DELETE /prompts/:id` (with
      the fixture prompt's id); assert status `204` and an empty response
      body (`response.body` is `{}`/`response.text` is `''`, per `supertest`
      conventions for a `204`); afterward, assert a follow-up
      `GET /prompts/:id` for the same id responds `404` (confirms the row is
      gone, satisfying AC2 end-to-end); clean up the fixture category
      afterward (the prompt row is already gone). Fails: no
      `DELETE /prompts/:id` route, handler, use-case wiring, or schema exists
      yet.
    - Green: create `src/schemas/DeletePromptSchema.ts` per plan.md §6
      (`params.id` validated with `z.uuid({ error: ... })`);
      create `src/handlers/DeletePromptHandler.ts` that reads
      `req.parsedRequest?.params`, calls
      `deletePromptUseCase.invoke({ id })` inside a `try/catch`, and responds
      `res.status(204).send()` on success; add
      `deletePromptUseCase = new DeletePromptUseCase(promptRepository)` to
      `src/logic/prompt/services.ts`; register
      `app.delete('/prompts/:id', validateRequestMiddleware(DeletePromptSchema), deletePromptHandler)`
      in `src/app.ts`.
    - Covers: AC1 (see T1 text above); AC2 (see T3 text above).

- [x] T5. `DELETE /prompts/:id` removes the prompt from prompt listings
    - Red: same file as T4 — new `it`; seed a fixture category and a fixture
      prompt; `DELETE /prompts/:id` for the fixture prompt's id; then
      `GET /prompts` and assert the fixture prompt's id is not present among
      the returned ids (filter down to the test's own fixture id per the
      `testing` skill's anti-flakiness convention, rather than asserting on
      the full list); clean up the fixture category afterward.
    - Green: none beyond T4 — `ListPromptsUseCase`/`GET /prompts`
      (`002-list-prompts`, existing) already selects only rows physically
      present in `prompts`, so a deleted row is automatically excluded; run
      the test to confirm.
    - Covers: AC3 "Given a prompt that was just deleted, When the user lists
      prompts afterward (with or without a category filter that would
      otherwise have matched it), Then the deleted prompt does not appear in
      the results."

- [x] T6. `DELETE /prompts/:id` returns a not-found error when the id matches no prompt
    - Red: same file as T4 — new `it`; `DELETE /prompts/:id` with a random
      `id` (`faker.string.uuid()`) that matches no seeded prompt; assert
      status `404` and the JSON body equals
      `{ error: 'Prompt not found: <that id>' }`.
    - Green: `DeletePromptHandler.ts`'s `catch` block catches
      `PromptNotFoundError` specifically and responds
      `res.status(404).json({ error: err.message })` (plan.md §5).
    - Covers: AC4 (see T2 text above).

- [x] T7. `DELETE /prompts/:id` returns a not-found error when deleting an already-deleted id
    - Red: same file as T4 — new `it`; seed a fixture category and a fixture
      prompt; `DELETE /prompts/:id` once (asserting `204`, as in T4); then
      `DELETE /prompts/:id` again for the same id; assert the second call's
      status is `404` and the JSON body equals
      `{ error: 'Prompt not found: <that id>' }`; clean up the fixture
      category afterward.
    - Green: none beyond T4/T6 — the second call's
      `DeletePromptUseCase.invoke()` finds no row via `findById` and throws
      `PromptNotFoundError` identically to T6; run the test to confirm.
    - Covers: AC5 "Given a prompt id that was already deleted (or never
      existed), When the user attempts to delete it again, Then the user is
      told the prompt was not found (E1), identical to attempting to delete
      any other unmatched id."

- [x] T8. `DELETE /prompts/:id` rejects a non-uuid id with a validation error
    - Red: same file as T4 — new `describe('Request Validation', ...)` block
      with one `it`; `DELETE /prompts/not-a-uuid` (a clearly malformed,
      non-uuid path segment), no seeding needed; assert status `400` and body
      `{ errors: expect.arrayContaining([{ field: 'params.id', error: 'Invalid UUID value' }]) }`,
      mirroring `CreatePromptHandler.test.ts` / `UpdatePromptHandler.test.ts`'s
      non-uuid `category_id` cases. Fails: `DeletePromptSchema.params.id` is not
      yet a `z.uuid()`, so `not-a-uuid` passes validation and reaches the use
      case (returning `404`, not `400`).
    - Green: `DeletePromptSchema` (T4) validates `params.id` with
      `z.uuid({ error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value') })`
      per plan.md §6; the malformed id is rejected by
      `validateRequestMiddleware` before the handler runs.
    - Covers: boundary validation of the path id (plan.md §6); no new AC — a
      malformed id is now a `400` shape error rather than reaching the E1 `404`.

- [x] T9. `UpdatePromptSchema` path id is validated as a uuid
    - Red: `tests/integration/handlers/UpdatePromptHandler.test.ts` — inside the
      existing `describe('Request Validation', ...)` block, new `it`;
      `PUT /prompts/not-a-uuid` with an otherwise-valid body (valid `title`,
      `prompt`, `category_id`, `description`); assert status `400` and body
      `{ errors: expect.arrayContaining([{ field: 'params.id', error: 'Invalid UUID value' }]) }`.
      Fails: `UpdatePromptSchema.params.id` is still `z.string()`, so
      `not-a-uuid` passes and the request reaches the use case (returning `404`).
    - Green: change `src/schemas/UpdatePromptSchema.ts` `params.id` from
      `z.string()` to the same
      `z.uuid({ error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value') })`
      shape as `DeletePromptSchema` (plan.md §6). Documented under this spec
      (007) per user instruction; spec 006's docs are left untouched. Run the
      full suite to confirm no existing PUT test regresses (all existing path
      ids there are fixture ids or `faker.string.uuid()`).
    - Covers: consistent uuid validation of the update path id (plan.md §6);
      no 007 AC — a maintenance tightening carried under this spec.

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | ----------------------------------------- | -------------------- |
| AC1 | Given an existing prompt, When the user deletes it by its id, Then the prompt is permanently removed and the user is told the removal succeeded. | T1, T3, T4 |
| AC2 | Given a prompt that was just deleted, When the user looks it up individually afterward, Then the prompt is not found, as if it never existed. | T3, T4 |
| AC3 | Given a prompt that was just deleted, When the user lists prompts afterward (with or without a category filter that would otherwise have matched it), Then the deleted prompt does not appear in the results. | T5 |
| AC4 | Given no prompt exists with the supplied id, When the user attempts to delete it, Then the user is told the prompt was not found (E1), and no prompt is removed. | T2, T6 |
| AC5 | Given a prompt id that was already deleted (or never existed), When the user attempts to delete it again, Then the user is told the prompt was not found (E1), identical to attempting to delete any other unmatched id. | T7 |
