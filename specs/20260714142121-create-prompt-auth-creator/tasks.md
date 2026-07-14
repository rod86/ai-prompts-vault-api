# Tasks: Authenticated create-prompt with recorded creator
Plan: specs/20260714142121-create-prompt-auth-creator/plan.md

- [x] T1. Add `user_id` to the prompts schema + allow schema-only cross-context imports
  - Type: infrastructure (schema) + tooling
  - Depends on: none
  - Red: none — schema/boundaries config change; verified by `npm run lint` (the new cross-context `users` import in the prompts schema passes, and a probe non-schema cross-context import still fails) and `npm run typecheck`.
  - Green: `src/modules/prompt/infrastructure/database/schema.ts` — import `users` and add `userId: uuid('user_id').notNull().references(() => users.id)`; `.eslintrc.json` — add the file-scoped `schema` boundaries element (before `infrastructure`) and allow `infrastructure`→`schema` and `schema`→`schema` across contexts (plan §3).
  - Covers: enables §4 persistence; V3

- [x] T2. Generate & apply the `user_id` migration
  - Type: migration
  - Depends on: T1
  - Red: none — migration artifact; verified by `npm run db:migrate` applying cleanly and the `prompts.user_id` column + FK existing.
  - Green: `npx drizzle-kit generate` to emit `drizzle/<generated>.sql`; apply with `npm run db:migrate`.
  - Covers: §4 migration

- [x] T3. Repository persists and returns the creator
  - Type: infrastructure
  - Depends on: T2
  - Red: extend `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` — seed a `users` row, `create` a prompt with a `userId`, then assert `selectPromptsByIds` shows the persisted `user_id` and `findById`/`findAll` return `user: { id, name }`. Fails because `Prompt` has no `user` and `create` ignores `userId`.
  - Green: `src/modules/prompt/domain/Prompt.ts` — add required `user: { id: string; name: string }` to `Prompt` and `userId: string` to `CreatePrompt`; `DrizzlePromptRepository` — insert `userId` in `create`, `innerJoin(users)` + map `user` in `findAll`/`findById`. Ripple (to stay compiled/green; `UpdatePromptUseCase`'s return is later consumed by T9): `UpdatePromptUseCase` returns `user: existingPrompt.user`; `PromptModelFactory`/`PromptModel` gain `userId` (omit `user`); `insertPrompts` sets `userId`; add `user`/`userId` to fixtures — and seed a `users` row for the new FK — in the existing prompt unit tests (`Get`/`Update`/`Delete`/`ListPrompts` use-case tests) and prompt-inserting integration tests.
  - Covers: AC1 (persistence + return); V2/V3

- [x] T4. Create use case records the creator and returns the resolved prompt
  - Type: application
  - Depends on: T3
  - Red: extend `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts` — given a query carrying `userId`, assert `promptRepository.create` receives that `userId` and the use case returns the post-insert `findById` result (carrying `user`); keep the category-not-found path. Fails because the query/use case has no `userId` and builds its result in memory.
  - Green: `src/modules/prompt/application/CreatePromptUseCase.ts` — add `userId` to `CreatePromptQuery`, pass it to `create`, and return `findById(id)` (throw `PromptCreationError` if unexpectedly absent) instead of the in-memory object.
  - Covers: AC1 (application); V2

- [x] T5. Require authentication on the create route
  - Type: route handler
  - Depends on: none
  - Red: extend `tests/integration/handlers/prompts/createPromptHandler.test.ts` — `POST /prompts` with a valid body but **no** `Authorization` header returns `401` and writes no row. Fails because the route is currently public. (Green-keeping: add a valid `Authorization: Bearer <jwt>` + seeded user to the existing happy-path, category-not-found, and validation tests so they still reach the handler.)
  - Green: `src/routes/prompts.routes.ts` — mount `requireAuthMiddleware` before `validateRequestMiddleware(CreatePromptSchema)` on `POST /prompts`.
  - Covers: AC2; V1, E1

- [ ] T6. Authentication is checked before body validation
  - Type: route handler
  - Depends on: T5
  - Red: add to `createPromptHandler.test.ts` — a request with **no** `Authorization` header **and** an invalid body returns `401` (not `400`) and writes no row. Fails only if the guard runs after validation.
  - Green: none — the ordering is delivered by T5's middleware placement; this task adds the test that proves it.
  - Covers: AC3; V1

- [ ] T7. Unknown category is rejected on an authenticated request
  - Type: route handler
  - Depends on: T5
  - Red: add to `createPromptHandler.test.ts` — an authenticated request naming a non-existent `category_id` returns `422` (`CategoryNotFoundError`) and writes no row.
  - Green: none — `CategoryNotFoundError`→422 already exists; the test authenticates to reach the category check behind the guard.
  - Covers: AC4; E2

- [ ] T8. Handler stamps the authenticated user and exposes the creator
  - Type: route handler
  - Depends on: T4, T5
  - Red: extend the happy-path test in `createPromptHandler.test.ts` — an authenticated request with a valid body returns `201` whose body includes `user: { id, name }` (the token's user) beside `category`, and `selectPromptsByIds` shows the matching `user_id`. Fails because the handler neither passes the caller nor returns `user`.
  - Green: `src/handlers/prompts/createPromptHandler.ts` — narrow `req.auth` (throw `MissingTokenError` if absent, satisfying `no-non-null-assertion`), pass `userId: req.auth.userId` into `createPromptUseCase.invoke`, and add `user: prompt.user` to the 201 response.
  - Covers: AC1 (end-to-end)

- [ ] T9. Update-prompt response exposes the creator
  - Type: route handler
  - Depends on: T3
  - Red: extend the happy-path test in `tests/integration/handlers/prompts/updatePromptHandler.test.ts` — seed a `users` row and a prompt created by that user, `PUT /prompts/:id` (no `Authorization` header), and assert the `200` body's `toEqual` now includes `user: { id, name }` (the original creator, unchanged) beside `category`. Fails because the handler omits `user`.
  - Green: `src/handlers/prompts/updatePromptHandler.ts` — add `user: prompt.user` to the 200 response.
  - Covers: AC5

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a valid authenticated request with valid prompt data, When the user creates a prompt, Then the prompt is stored with the authenticated user as its creator and the response includes the creator's id and name together with the category. | T3, T4, T8 |
| AC2 | Given a request that carries no valid authenticated identity, When the user attempts to create a prompt, Then the request is rejected as unauthorized and no prompt is stored. | T5 |
| AC3 | Given a request that carries no valid authenticated identity and an invalid body, When the user attempts to create a prompt, Then the request is rejected as unauthorized (not as invalid input) and no prompt is stored. | T6 |
| AC4 | Given a valid authenticated request naming a category that does not exist, When the user attempts to create a prompt, Then the request is rejected as unknown category and no prompt is stored. | T7 |
| AC5 | Given an existing prompt with a recorded creator, When it is updated (without authentication), Then the update succeeds and its response includes the original creator's id and name alongside the category, with the creator unchanged. | T9 |
