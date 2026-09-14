# Tasks: Get a prompt by id
Plan: specs/20260914105014-get-prompt-by-id/plan.md

- [x] T1. Fetch an existing prompt without credentials
  - Type: route handler
  - Depends on: none
  - Red: New integration test `tests/integration/handlers/prompts/getPromptHandler.test.ts` (`describe('GET /prompts/:id')`), wired like `deletePromptHandler.test.ts`: `createPromptCategoryFixture`/`createUserFixture`/`createPromptFixture`, shared category + user inserted in `beforeAll`, `promptFixture.cleanup()` in `afterEach`, category/user cleanup in `afterAll`, a unique `X-Forwarded-For` per test. Insert a prompt for that category and user, then `GET /prompts/<id>` with **no `Authorization` header**; assert `status === 200` and `response.body` equals the full prompt — `id`, `title`, `prompt`, `description`, `category: { id, name }`, `user: { id, name }`, `created_at`/`updated_at` as the fixture dates' `.toISOString()`. Fails because the route, handler, and schema do not exist yet (404 not-found envelope).
  - Green: Add `GetPromptSchema` (`params.id` via `uuidField()`) + `GetPromptRequest` to `src/routes/prompts/prompts.request.schema.ts`; add `src/handlers/prompts/getPromptHandler.ts` typed `RequestHandler<Record<string, string>, PromptResponse>` invoking `getPromptUseCase.invoke({ id: params.id })` and responding `res.status(200).json({...})` with `description: prompt.description || null` and `.toISOString()` timestamps; register `promptsRouter.get('/prompts/:id', validateRequestMiddleware(GetPromptSchema), getPromptHandler)` in `src/routes/prompts/prompts.routes.ts` **without** `requireAuthMiddleware`.
  - Covers: AC1 "Given a prompt exists with a known identifier, When a consumer fetches it by that identifier **without supplying any credentials**, Then the prompt's full details are returned: identifier, title, prompt text, description, category (identifier and name), owner (identifier and name), and creation and last-update instants."; input field `id`, returned fields

- [x] T2. Response matches the documented prompt shape
  - Type: route handler
  - Depends on: T1
  - Red: In the same test file, a dedicated `it` inserting a prompt and fetching it, asserting `expect(() => PromptResponseSchema.parse(response.body)).not.toThrow()` (the pattern of `updatePromptHandler.test.ts`).
  - Green: none — `getPromptHandler` from T1 already types its body from `PromptResponse` and maps every field; the assertion passes once T1 is green.
  - Covers: AC5 "Given a prompt exists, When a consumer fetches it by its identifier, Then the returned details conform to the documented shape of a prompt result."

- [x] T3. A prompt without a description reports an empty description
  - Type: route handler
  - Depends on: T1
  - Red: In the same test file, insert a prompt with `description: undefined` explicitly passed to `promptFixture.insert({ categoryId, userId, description: undefined })` and fetch it; assert `response.status === 200` and `response.body.description` is `null`. Fails today because `PromptModelFactory.create` substitutes a faker description for an explicitly-passed `undefined`, so the row is stored with a description.
  - Green: In `tests/lib/modelFactories/PromptModelFactory.ts`, honour an explicitly provided `description` key (use a presence check instead of `data.description ?? faker.lorem.sentence()`) so the prompt is persisted with no description. No production change — the handler's `description || null` mapping from T1 already produces `null`.
  - Covers: AC2 "Given a prompt that has no description, When a consumer fetches it by its identifier, Then the description is reported as empty rather than omitted."; field `description`

- [ ] T4. Fetching an unknown prompt returns prompt-not-found
  - Type: route handler
  - Depends on: T1
  - Red: In the same test file, `GET /prompts/<random-uuid>` for an id matching no prompt; assert `status === 404` and body equals `{ status: 404, code: 'PROMPT_NOT_FOUND', message: 'Prompt not found: <id>' }`.
  - Green: none — `GetPromptUseCase` already throws `PromptNotFoundError` for a missing id and `errorMiddleware` already maps the `NotFound` category to 404; the T1 wiring makes the test pass.
  - Covers: AC3 "Given no prompt exists with a given well-formed identifier, When a consumer fetches by that identifier, Then a prompt-not-found error (E1) is returned."; E1

- [ ] T5. Fetching with a malformed id returns invalid-identifier
  - Type: route handler
  - Depends on: T1
  - Red: In the same test file, `GET /prompts/not-a-uuid`; assert `status === 400` and `response.body.details.params` contains `{ id: 'Invalid UUID value' }`.
  - Green: none — `GetPromptSchema` + `validateRequestMiddleware` from T1, mapped by `errorMiddleware`, already produce this.
  - Covers: AC4 "Given a malformed identifier, When a consumer fetches by that identifier, Then an invalid-identifier error (E2) is returned."; V1, E2

- [ ] T6. The API description documents the read operation with exactly its real outcomes
  - Type: route handler
  - Depends on: T1
  - Red: In `tests/integration/docs.test.ts`, inside the existing `it('documents the prompt endpoints with exactly their real outcomes and bearer security')`, assert `Object.keys(paths['/prompts/{id}'].get.responses).sort()` equals `['200', '400', '404', '429']` and `paths['/prompts/{id}'].get.security` is `undefined`. Fails because the path item has no `get` operation.
  - Green: In `src/docs/prompts.ts`, add a `get` operation to the existing `'/prompts/{id}'` path item — `tags: ['Prompts']`, a summary, **no** `security`, `requestParams: { path: GetPromptSchema.shape.params }`, and responses `200` (`PromptResponseSchema`), `400` (`validationErrorResponse('Invalid input')`), `404` (`ErrorResponseSchema`, prompt not found), `429` (`rateLimitedResponse`).
  - Covers: AC6 "Given the running API, When the API description document is retrieved, Then it lists the read-a-prompt operation with exactly the outcomes it can produce — success, invalid identifier, prompt not found, and allowance exhausted — and without a credential requirement."

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a prompt exists with a known identifier, When a consumer fetches it by that identifier **without supplying any credentials**, Then the prompt's full details are returned: identifier, title, prompt text, description, category (identifier and name), owner (identifier and name), and creation and last-update instants. | T1 |
| AC2 | Given a prompt that has no description, When a consumer fetches it by its identifier, Then the description is reported as empty rather than omitted. | T3 |
| AC3 | Given no prompt exists with a given well-formed identifier, When a consumer fetches by that identifier, Then a prompt-not-found error (E1) is returned. | T4 |
| AC4 | Given a malformed identifier, When a consumer fetches by that identifier, Then an invalid-identifier error (E2) is returned. | T5 |
| AC5 | Given a prompt exists, When a consumer fetches it by its identifier, Then the returned details conform to the documented shape of a prompt result. | T2 |
| AC6 | Given the running API, When the API description document is retrieved, Then it lists the read-a-prompt operation with exactly the outcomes it can produce — success, invalid identifier, prompt not found, and allowance exhausted — and without a credential requirement. | T6 |
