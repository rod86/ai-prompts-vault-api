# Tasks: Owner-only, authenticated update & delete of a prompt
Plan: specs/20260715065737-auth-owner-update-delete-prompt/plan.md

- [x] T1. Require authentication on the update route
  - Type: route handler
  - Depends on: none
  - Red: extend `tests/integration/handlers/prompts/updatePromptHandler.test.ts` — `PUT /prompts/:id` with a valid body but **no** `Authorization` header returns `401` and leaves the prompt unchanged (`selectPromptsByIds`). Fails because the route is currently public. Green-keeping: add a valid `Authorization: Bearer <jwt>` whose user **is the prompt's creator** to the existing happy-path test so it still reaches the handler and stays `200`.
  - Green: `src/routes/prompts.routes.ts` — mount `requireAuthMiddleware` before `validateRequestMiddleware(UpdatePromptSchema)` on `PUT /prompts/:id`.
  - Covers: AC3 "Given a request to update a prompt that carries no valid authenticated identity, When the user attempts the update, Then it is rejected as unauthorized and the prompt is unchanged."; AC1 (owner happy path retained); V1, E1

- [x] T2. Update authentication is checked before body validation
  - Type: route handler
  - Depends on: T1
  - Red: add to `updatePromptHandler.test.ts` — a request with **no** `Authorization` header **and** an invalid body (e.g. missing `title`) returns `401` (not `400`) and leaves the prompt unchanged. Fails only if the guard runs after validation.
  - Green: none — ordering is delivered by T1's middleware placement; this task adds the test that proves it.
  - Covers: AC5 "Given a request to update a prompt that carries no valid authenticated identity and an invalid body, When the user attempts the update, Then it is rejected as unauthorized (not as invalid input) and the prompt is unchanged."; V1, E1

- [x] T3. Update use case rejects a non-owner
  - Type: application
  - Depends on: none
  - Red: extend `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` — given `findById` returns a prompt whose `user.id` is the owner, When `invoke` is called with a `userId` for a **different** user, Then it rejects with `PromptOwnershipError` and `promptRepository.update` is **not** called. Green-keeping: add a matching `userId` to the existing happy-path and category-not-found queries so they still pass. Fails because `UpdatePromptQuery` has no `userId` and no ownership check exists.
  - Green: create `src/modules/prompt/domain/errors/PromptOwnershipError.ts` (carries the prompt id); `src/modules/prompt/application/UpdatePromptUseCase.ts` — add `userId` to `UpdatePromptQuery` and, after the not-found guard and before category resolution, throw `PromptOwnershipError` when `existingPrompt.user.id !== query.userId`. Green-keep typecheck: `src/handlers/prompts/updatePromptHandler.ts` narrows `req.auth` (throw `MissingTokenError` if absent) and passes `userId: req.auth.userId`.
  - Covers: AC6 "Given a prompt created by another user, When an authenticated user who is not its creator attempts to update it, Then the request is rejected as forbidden and the prompt is unchanged." (application); V2, E2

- [x] T4. Update: not found is decided before ownership
  - Type: application
  - Depends on: T3
  - Red: extend `UpdatePromptUseCase.test.ts` — given `findById` returns nothing, When `invoke` is called with a `userId`, Then it rejects with `PromptNotFoundError` (not `PromptOwnershipError`). (Repurpose the existing not-found test, now carrying a `userId`.)
  - Green: none — the ownership check sits after the `findById` not-found guard from T3; this task adds the test that proves the ordering.
  - Covers: AC8 "Given a well-formed identifier that matches no existing prompt, When an authenticated user attempts to update or delete it, Then the request is rejected as not found (not as forbidden) and nothing changes." (update)

- [ ] T5. Update by a non-owner returns forbidden (end-to-end)
  - Type: route handler
  - Depends on: T1, T3
  - Red: add to `updatePromptHandler.test.ts` — seed a prompt created by user A, authenticate as a **different** seeded user B, `PUT /prompts/:id` with a valid body, and assert `403` (`PromptOwnershipError`) with the prompt unchanged in the DB (`selectPromptsByIds`). Fails because `PromptOwnershipError` is unmapped (falls through to `500`).
  - Green: `src/middleware/errorMiddleware.ts` — map `PromptOwnershipError` → `403 { error, message }`.
  - Covers: AC6 "Given a prompt created by another user, When an authenticated user who is not its creator attempts to update it, Then the request is rejected as forbidden and the prompt is unchanged." (end-to-end); E2

- [ ] T6. Require authentication on the delete route
  - Type: route handler
  - Depends on: none
  - Red: extend `tests/integration/handlers/prompts/deletePromptHandler.test.ts` — `DELETE /prompts/:id` with **no** `Authorization` header returns `401` and the prompt is **not** removed (`selectPromptsByIds` still finds it). Fails because the route is public. Green-keeping: add a valid `Authorization: Bearer <jwt>` whose user **is the prompt's creator** to the existing happy-path (204) test so it still deletes.
  - Green: `src/routes/prompts.routes.ts` — mount `requireAuthMiddleware` before `validateRequestMiddleware(DeletePromptSchema)` on `DELETE /prompts/:id`.
  - Covers: AC4 "Given a request to delete a prompt that carries no valid authenticated identity, When the user attempts the delete, Then it is rejected as unauthorized and the prompt is not removed."; AC2 (owner happy path retained); V1, E1

- [ ] T7. Delete use case rejects a non-owner
  - Type: application
  - Depends on: T3
  - Red: extend `tests/unit/modules/prompt/application/DeletePromptUseCase.test.ts` — given `findById` returns a prompt whose `user.id` is the owner, When `invoke` is called with a `userId` for a **different** user, Then it rejects with `PromptOwnershipError` and `repository.delete` is **not** called. Green-keeping: add a matching `userId` to the existing happy-path query so it still passes. Fails because `DeletePromptQuery` has no `userId` and no ownership check exists.
  - Green: `src/modules/prompt/application/DeletePromptUseCase.ts` — add `userId` to `DeletePromptQuery` and, after the not-found guard and before `delete`, throw `PromptOwnershipError` (from T3) when `prompt.user.id !== query.userId`. Green-keep typecheck: `src/handlers/prompts/deletePromptHandler.ts` narrows `req.auth` (throw `MissingTokenError` if absent) and passes `userId: req.auth.userId`.
  - Covers: AC7 "Given a prompt created by another user, When an authenticated user who is not its creator attempts to delete it, Then the request is rejected as forbidden and the prompt is not removed." (application); V2, E2

- [ ] T8. Delete: not found is decided before ownership
  - Type: application
  - Depends on: T7
  - Red: extend `DeletePromptUseCase.test.ts` — given `findById` returns nothing, When `invoke` is called with a `userId`, Then it rejects with `PromptNotFoundError` (not `PromptOwnershipError`). (Repurpose the existing not-found test, now carrying a `userId`.)
  - Green: none — the ownership check sits after the not-found guard from T7; this task adds the test that proves the ordering.
  - Covers: AC8 "Given a well-formed identifier that matches no existing prompt, When an authenticated user attempts to update or delete it, Then the request is rejected as not found (not as forbidden) and nothing changes." (delete)

- [ ] T9. Delete by a non-owner returns forbidden (end-to-end)
  - Type: route handler
  - Depends on: T6, T7, T5
  - Red: add to `deletePromptHandler.test.ts` — seed a prompt created by user A, authenticate as a **different** seeded user B, `DELETE /prompts/:id`, and assert `403` (`PromptOwnershipError`) with the prompt still present (`selectPromptsByIds`). Fails if ownership isn't enforced end-to-end.
  - Green: none — `PromptOwnershipError` → 403 mapping already added in T5; the delete use case enforces ownership from T7.
  - Covers: AC7 "Given a prompt created by another user, When an authenticated user who is not its creator attempts to delete it, Then the request is rejected as forbidden and the prompt is not removed." (end-to-end); E2

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a prompt owned by the authenticated user, When that user updates it with valid data, Then the update succeeds and the response includes the updated prompt with its creator's id and name alongside its category. | T1 (owner happy path), T3 |
| AC2 | Given a prompt owned by the authenticated user, When that user deletes it, Then the prompt is removed and a success-with-no-content result is returned. | T6 (owner happy path), T7 |
| AC3 | Given a request to update a prompt that carries no valid authenticated identity, When the user attempts the update, Then it is rejected as unauthorized and the prompt is unchanged. | T1 |
| AC4 | Given a request to delete a prompt that carries no valid authenticated identity, When the user attempts the delete, Then it is rejected as unauthorized and the prompt is not removed. | T6 |
| AC5 | Given a request to update a prompt that carries no valid authenticated identity and an invalid body, When the user attempts the update, Then it is rejected as unauthorized (not as invalid input) and the prompt is unchanged. | T2 |
| AC6 | Given a prompt created by another user, When an authenticated user who is not its creator attempts to update it, Then the request is rejected as forbidden and the prompt is unchanged. | T3, T5 |
| AC7 | Given a prompt created by another user, When an authenticated user who is not its creator attempts to delete it, Then the request is rejected as forbidden and the prompt is not removed. | T7, T9 |
| AC8 | Given a well-formed identifier that matches no existing prompt, When an authenticated user attempts to update or delete it, Then the request is rejected as not found (not as forbidden) and nothing changes. | T4, T8 |
