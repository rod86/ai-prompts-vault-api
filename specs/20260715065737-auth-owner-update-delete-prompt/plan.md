# Plan: Owner-only, authenticated update & delete of a prompt
Spec: specs/20260715065737-auth-owner-update-delete-prompt/spec.md

## 1. Approach

Mirror the already-shipped create-prompt auth wiring
(`specs/20260714142121-create-prompt-auth-creator`) onto the update and delete
endpoints:

1. Mount the existing `requireAuthMiddleware` **before** request validation on
   `PUT /prompts/:id` and `DELETE /prompts/:id`, exactly as on `POST /prompts`
   (`src/routes/prompts.routes.ts`). This delivers V1/E1 and the auth-before-
   validation ordering for free.
2. Thread the authenticated `req.auth.userId` from `updatePromptHandler` /
   `deletePromptHandler` into their use cases as a new `userId` query field —
   narrowing `req.auth` and throwing `MissingTokenError` if absent, the same
   defensive pattern `createPromptHandler` already uses.
3. Enforce ownership **in the use cases** (business logic, per DDD): after the
   existing `findById` not-found guard, compare the prompt's recorded creator
   (`existingPrompt.user.id`, already carried on the `Prompt` entity) to
   `query.userId`; on mismatch throw a new `PromptOwnershipError` **before** any
   further work (category resolution on update, the delete call). Placing the check
   after `findById` makes *not found* win over *forbidden* (V2 ordering, AC8).
4. Map `PromptOwnershipError` → **403** in `src/middleware/errorMiddleware.ts`,
   alongside the existing domain-error mappings.

No persistence change: the owner is the prompt's creator, already stored as
`prompts.user_id` and exposed as `Prompt.user` by the create-auth feature. Reused
as-is: `requireAuthMiddleware` + `validateTokenUseCase`, the `req.auth` typing
(`src/types/express.d.ts`), the auth→401 mappings, and the not-found (404) /
unknown-category (422) / invalid-input (400) paths already in place.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Update route | existing | `src/routes/prompts.routes.ts` | Insert `requireAuthMiddleware` before `validateRequestMiddleware(UpdatePromptSchema)` on `PUT /prompts/:id`. |
| Delete route | existing | `src/routes/prompts.routes.ts` | Insert `requireAuthMiddleware` before `validateRequestMiddleware(DeletePromptSchema)` on `DELETE /prompts/:id`. |
| Update handler | existing | `src/handlers/prompts/updatePromptHandler.ts` | Narrow `req.auth` (throw `MissingTokenError` if absent); pass `userId: req.auth.userId` into the use case. Response shape unchanged. |
| Delete handler | existing | `src/handlers/prompts/deletePromptHandler.ts` | Narrow `req.auth` (throw `MissingTokenError` if absent); pass `userId: req.auth.userId` into the use case. Response unchanged (204). |
| Update use case | existing | `src/modules/prompt/application/UpdatePromptUseCase.ts` | `UpdatePromptQuery`: add `userId`. After the not-found guard, throw `PromptOwnershipError` if `existingPrompt.user.id !== query.userId`, before category resolution. |
| Delete use case | existing | `src/modules/prompt/application/DeletePromptUseCase.ts` | `DeletePromptQuery`: add `userId`. After the not-found guard, throw `PromptOwnershipError` if `prompt.user.id !== query.userId`, before `delete`. |
| Ownership error | **new** | `src/modules/prompt/domain/errors/PromptOwnershipError.ts` | Domain error carrying the prompt id; message neutral for both actions (e.g. "You are not allowed to modify or delete this prompt: <id>"). |
| Error mapping | existing | `src/middleware/errorMiddleware.ts` | Add `PromptOwnershipError` → `403 { error, message }`. |
| Update handler tests | existing | `tests/integration/handlers/prompts/updatePromptHandler.test.ts` | Green-keep with a valid Bearer token whose user is the prompt's creator; add no-token (401), auth-before-validation (401), and non-owner (403) cases. |
| Delete handler tests | existing | `tests/integration/handlers/prompts/deletePromptHandler.test.ts` | Green-keep with a valid Bearer token whose user is the prompt's creator; add no-token (401) and non-owner (403) cases. |
| Update use-case tests | existing | `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` | Add matching `userId` to existing queries (green-keep); add non-owner and not-found-before-ownership cases. |
| Delete use-case tests | existing | `tests/unit/modules/prompt/application/DeletePromptUseCase.test.ts` | Add matching `userId` to existing queries (green-keep); add non-owner and not-found-before-ownership cases. |

*§2 note — token minting in integration tests:* the create-auth handler tests
(`createPromptHandler.test.ts`) already mint a valid `Authorization: Bearer <jwt>`
for a seeded user; reuse that exact pattern to authenticate as the prompt's creator
(owner) or as a second seeded user (non-owner).

## 3. Interfaces & contracts

- `PUT /prompts/:id` — unchanged request body (`snake_case`: `title`, `prompt`,
  `category_id`, `description?`) and unchanged success `200` body (incl. `user` and
  `category`), but now **requires** `Authorization: Bearer <token>` and that the
  token's user be the prompt's creator. Failure ordering: `401` (no/invalid token) →
  `400` (invalid body) → `404` (not found) → `403` (not owner) → `422` (unknown
  category).
- `DELETE /prompts/:id` — unchanged success `204`, but now **requires**
  `Authorization: Bearer <token>` and owner match. Failure ordering: `401` → `400`
  (malformed id) → `404` → `403`.
- `UpdatePromptUseCase.invoke(query)` — `UpdatePromptQuery` gains `userId: string`.
- `DeletePromptUseCase.invoke(query)` — `DeletePromptQuery` gains `userId: string`.
- `PromptRepositoryInterface` — unchanged. `Prompt` entity — unchanged (already
  carries `user: { id, name }`).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `MissingTokenError` / `InvalidTokenError` / `TokenExpiredError` (from the auth guard) | `401` `{ error, message }` (already mapped); nothing changes |
| E2 | `PromptOwnershipError` (**new**) | `403` `{ error, message }` (new mapping); nothing changes |
| E3 | `PromptNotFoundError` | `404` `{ error, message }` (existing); nothing changes |
| E4 | `CategoryNotFoundError` | `422` `{ error, message }` (existing); no update |
| E5 | `RequestValidationError` | `400` `{ error, message, details }` (existing); nothing changes |

## 4. Data & persistence

none — ownership uses the existing `prompts.user_id` (creator) column and the
`Prompt.user` projection introduced by
`specs/20260714142121-create-prompt-auth-creator`. No schema change, no migration.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Request carries a valid authenticated identity, checked before body/identifier validation | `requireAuthMiddleware` mounted before `validateRequestMiddleware` on `PUT /prompts/:id` and `DELETE /prompts/:id` | → E1 |
| V2 | Authenticated requester is the prompt's creator, checked after the not-found guard and before further processing | `UpdatePromptUseCase` / `DeletePromptUseCase` compare `existingPrompt.user.id` to `query.userId` | → E2 (E3 first if the prompt does not exist) |

## 6. Dependency changes

none

## 7. Assumptions & risks

Assumptions:
1. Auth is checked before body/identifier validation, consistent with create-prompt
   Decision 4 — consequence if wrong: an unauthenticated request with invalid input
   returns `400` instead of `401`.
2. Existence is decided before ownership (the `findById` not-found guard precedes the
   ownership compare) — consequence if wrong: a request for a non-existent prompt
   could surface as `403`, leaking that ownership was even evaluated.
3. A single `PromptOwnershipError` (neutral message) serves both update and delete —
   consequence if wrong: per-action errors/messages are needed.
4. Ownership compares the immutable creator recorded at creation
   (`existingPrompt.user.id`, per create-prompt Decision 6) — consequence if wrong:
   none; the creator never changes.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Existing update/delete integration tests break once auth is required (they send no token) | high | suite red | Green-keep each in the route-auth task: authenticate as the prompt's creator so happy paths still pass |
| R2 | Adding `userId` to the query types breaks the handlers'/tests' typecheck before they pass it | med | build red | The use-case task's Green also updates the handler to pass `userId` and green-keeps the use-case tests |
| R3 | Ownership check placed before the not-found guard would `403` on a missing prompt | low | wrong ordering (AC8) | Check is written strictly after `findById`; AC8 tests assert not-found wins |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Update, no Authorization header | valid body, existing prompt | `401`; prompt unchanged | AC3 |
| Update, no token + invalid body | missing `title`, no token | `401` (auth wins over validation) | AC5 |
| Update by non-owner | valid token for user B, prompt owned by A | `403` `PromptOwnershipError`; prompt unchanged | AC6 |
| Update by owner | valid token for A, prompt owned by A, valid body | `200` with updated prompt (`user` + `category`) | AC1 |
| Update, unknown prompt id | valid token, well-formed id, no such prompt | `404` (not `403`); nothing changes | AC8 |
| Delete, no Authorization header | existing prompt | `401`; prompt not removed | AC4 |
| Delete by non-owner | valid token for user B, prompt owned by A | `403` `PromptOwnershipError`; prompt still present | AC7 |
| Delete by owner | valid token for A, prompt owned by A | `204`; prompt removed | AC2 |
| Delete, unknown prompt id | valid token, well-formed id, no such prompt | `404` (not `403`); nothing changes | AC8 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| V1 | `requireAuthMiddleware` before validation on both routes (§2, §5); E1 (§3) |
| V2 | ownership compare in both use cases after `findById` (§2, §5); `PromptOwnershipError` (§2, §3) |
| E1 | auth errors → 401 (§3) |
| E2 | `PromptOwnershipError` → 403 (§2 error mapping, §3) |
| E3 | existing `PromptNotFoundError` → 404, checked before ownership (§3, §5 V2 note) |
| E4 | existing `CategoryNotFoundError` → 422 (§3) |
| E5 | existing `RequestValidationError` → 400 (§3) |
| AC1 | update route auth + owner happy path (§2 update route/handler, §8) |
| AC2 | delete route auth + owner happy path (§2 delete route/handler, §8) |
| AC3 | `requireAuthMiddleware` on update route (§2, §5 V1) |
| AC4 | `requireAuthMiddleware` on delete route (§2, §5 V1) |
| AC5 | auth-before-validation ordering on update route (§2, §5 V1) |
| AC6 | update use-case ownership check + 403 mapping (§2, §3) |
| AC7 | delete use-case ownership check + 403 mapping (§2, §3) |
| AC8 | ownership check placed after `findById` in both use cases (§5 V2, §7 R3) |
