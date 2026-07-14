# Tasks: Delete a prompt
Plan: specs/20260714093226-delete-prompt/plan.md

- [x] T1. Delete an existing prompt returns 204 and removes it
  - Type: route handler
  - Depends on: none
  - Red: Integration test `DELETE /prompts/:id` (new `tests/integration/handlers/prompts/deletePromptHandler.test.ts`): insert a category + prompt, call `DELETE /prompts/<id>`, assert `status === 204` and empty body, then assert `selectPromptsByIds(db, [id])` returns no row. Fails because the route/handler/schema don't exist yet.
  - Green: Add `DeletePromptSchema` (params `id` UUID) + `DeletePromptRequest` to `src/routes/prompts.schema.ts`; add `src/handlers/prompts/deletePromptHandler.ts` invoking `deletePromptUseCase.invoke({ id: params.id })` and responding `res.status(204).send()`; register `promptsRouter.delete('/prompts/:id', validateRequestMiddleware(DeletePromptSchema), deletePromptHandler)` in `src/routes/prompts.routes.ts`.
  - Covers: AC1 "Given a prompt exists with a known identifier, When the user deletes it by that identifier, Then the prompt is removed from the vault and a success-with-no-content result is returned."; field `id`

- [x] T2. Deleting an unknown prompt returns prompt-not-found
  - Type: route handler
  - Depends on: T1
  - Red: In the same integration test file, call `DELETE /prompts/<random-uuid>` for an id matching no prompt; assert `status === 404` and body `{ error: 'PromptNotFoundError', message: 'Prompt not found: <id>' }`.
  - Green: none — `DeletePromptUseCase` already throws `PromptNotFoundError` for a missing id and `errorMiddleware` already maps it to 404; wiring from T1 makes the test pass.
  - Covers: AC2 "Given no prompt exists with a given well-formed identifier, When the user deletes by that identifier, Then a prompt-not-found error (E1) is returned and nothing is removed."; E1

- [ ] T3. Deleting with a malformed id returns invalid-identifier
  - Type: route handler
  - Depends on: T1
  - Red: In the same integration test file, call `DELETE /prompts/not-a-uuid`; assert `response.body.details.params` contains `{ id: 'Invalid UUID value' }` (status 400).
  - Green: none — `DeletePromptSchema` + `validateRequestMiddleware` from T1, mapped by `errorMiddleware`, already produce this; test passes.
  - Covers: AC3 "Given a malformed identifier, When the user deletes by that identifier, Then an invalid-identifier error (E2) is returned and nothing is removed."; V1, E2

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a prompt exists with a known identifier, When the user deletes it by that identifier, Then the prompt is removed from the vault and a success-with-no-content result is returned. | T1 |
| AC2 | Given no prompt exists with a given well-formed identifier, When the user deletes by that identifier, Then a prompt-not-found error (E1) is returned and nothing is removed. | T2 |
| AC3 | Given a malformed identifier, When the user deletes by that identifier, Then an invalid-identifier error (E2) is returned and nothing is removed. | T3 |
