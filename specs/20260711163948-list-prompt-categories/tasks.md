# Tasks: List prompt categories
Plan: specs/20260711163948-list-prompt-categories/plan.md

- [x] T1. `GET /prompt-categories` returns all categories sorted by name
  - Type: route handler
  - Depends on: none
  - Red: new integration test `tests/integration/promptCategories.test.ts` — construct a `DatabaseClient` inline from `@src/config/config.js` + `@src/config/drizzle-schema.js` (mirroring `DrizzlePromptCategoryRepository.test.ts`), seed categories whose names are inserted out of order (e.g. `Banana`, `apple`, `cherry`) via the `tests/lib/database` category helper, then `request(app).get('/prompt-categories')` and assert status `200` and body equals `[{ id, name }]` in case-insensitive name-ascending order. Fails first because no such route exists (Express returns 404).
  - Green: create `src/handlers/prompts/listPromptCategoriesHandler.ts` (`export const listPromptCategoriesHandler: RequestHandler` → `res.status(200).json(await listPromptCategoriesUseCase.invoke())`, importing from `@src/modules/prompt/services.js`); `src/routes/prompts.routes.ts` (`promptsRouter.get('/prompt-categories', listPromptCategoriesHandler)` — the prompt context's router); `src/routes/index.ts` (`apiRouter.use(promptsRouter)`); mount `app.use(apiRouter)` in `src/app.ts` after `/health`.
  - Covers: AC1 "Given one or more categories exist, When the client requests the list of categories, Then the system returns all of them, each with its id and name, ordered alphabetically by name ascending."

- [ ] T3. Unknown path returns the not-found contract
  - Type: middleware
  - Depends on: T1
  - Red: add a case to `tests/integration/app.test.ts` — `request(app).get('/does-not-exist')` asserts status `404` and body equals `{ error: 'NotFound', message: 'Cannot GET /does-not-exist' }`. Fails first because Express returns its built-in 404, not this envelope.
  - Green: create `src/middleware/notFoundMiddleware.ts` (`notFoundMiddleware(req, res)` → `res.status(404).json({ error: 'NotFound', message: \`Cannot ${req.method} ${req.path}\` })`); mount `app.use(notFoundMiddleware)` in `src/app.ts` **after** `app.use(apiRouter)` so it runs last.
  - Covers: none (establishes the HTTP not-found contract referenced by CLAUDE.md's testing section; not a domain AC — see plan §8).

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given one or more categories exist, When the client requests the list of categories, Then the system returns all of them, each with its id and name, ordered alphabetically by name ascending. | T1 |
| AC2 | Given no categories exist, When the client requests the list of categories, Then the system returns an empty list. | T1 (unconditional pass-through: `listPromptCategoriesHandler` returns the use case's result verbatim; the empty-array case is already proven at the unit level by `tests/unit/modules/prompt/application/ListPromptCategoriesUseCase.test.ts`, so no dedicated integration case exists — see plan §8) |
