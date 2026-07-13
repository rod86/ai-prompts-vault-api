# Tasks: Update prompt
Plan: specs/20260713152201-update-prompt/plan.md

<!-- All business logic (UpdatePromptUseCase, repository, prompt/category checks) already
exists and is unit-tested; this feature is the HTTP layer only. Tasks are integration
tests (supertest + real DB) against src/app.ts, mirroring the createPromptHandler
precedent. New PUT tests all live in
tests/integration/handlers/prompts/updatePromptHandler.test.ts, seeding an existing
prompt via the tests/lib/database/prompts helper (insertPrompts) + promptModelFactory and
a category via insertPromptCategories + promptCategoryModelFactory. -->

- [ ] T1. `PUT /prompts/:id` updates a prompt and returns 200 with the stored prompt
  - Type: route handler
  - Depends on: none
  - Red: new integration test `tests/integration/handlers/prompts/updatePromptHandler.test.ts`
    — construct a `DatabaseClient<DatabaseSchema>` inline from `@src/config/config.js` +
    `@src/config/drizzle-schema.js`, `client.connect()`/`getConnection()` and
    `databaseClient.connect()` (mirroring `createPromptHandler.test.ts`); seed one category
    via `insertPromptCategories` (`promptCategoryModelFactory`) and one prompt in that
    category via `insertPrompts` (`promptModelFactory.create({ categoryId: category.id })`);
    `request(app).put(\`/prompts/${prompt.id}\`).send({ title, prompt, category_id:
    category.id, description })` (snake_case wire body). Assert status `200` and body equals
    `{ id: prompt.id, title, prompt, description, category: { id: category.id, name:
    category.name }, created_at: <any string>, updated_at: <any string> }` (snake_case keys;
    **no** camelCase `categoryId`/`createdAt`/`updatedAt`); assert `created_at` equals the
    seeded prompt's original `createdAt` (preserved) and `updated_at` differs from the seeded
    `updatedAt` (advanced); then verify persistence with `selectPromptsByIds(db,
    [prompt.id])` (one row, matching new `title`/`prompt`/`description`/`promptCategoryId`).
    Cleanup via `deletePromptsByIds` + `deletePromptCategoriesByIds`. Fails first because no
    `PUT /prompts/:id` route exists (Express 404).
  - Green: in `src/routes/prompts.schema.ts` add `UpdatePromptSchema = z.object({ params:
    z.object({ id: z.uuid({...}) }), body: z.object({ title: z.string({...}), prompt:
    z.string({...}), category_id: z.uuid({...}), description: z.string().optional() }) })`
    (snake_case wire names; error messages mirroring `CreatePromptSchema`) and `type
    UpdatePromptRequest = z.infer<typeof UpdatePromptSchema>`; create
    `src/handlers/prompts/updatePromptHandler.ts` (`const updatePromptHandler:
    RequestHandler` → read `const { params, body } = req.parsedRequest as
    UpdatePromptRequest`, `const prompt = await updatePromptUseCase.invoke({ id: params.id,
    title: body.title, prompt: body.prompt, categoryId: body.category_id, description:
    body.description })`, then build the snake_case response inline and
    `res.status(200).json({ id: prompt.id, title: prompt.title, prompt: prompt.prompt,
    ...(prompt.description !== undefined && { description: prompt.description }), category:
    prompt.category, created_at: prompt.createdAt, updated_at: prompt.updatedAt })`;
    `export default`); add `promptsRouter.put('/prompts/:id',
    validateRequestMiddleware(UpdatePromptSchema), updatePromptHandler)` in
    `src/routes/prompts.routes.ts`.
  - Covers: AC1 "Given a well-formed request whose prompt and category both exist, When the
    client updates the prompt, Then the stored prompt's title, prompt text, category, and
    description are replaced with the submitted values and its last-updated moment is set to
    now, while its identifier and creation moment are preserved, and the response indicates
    the resource was updated successfully and contains the stored prompt: id, title, prompt
    text, description (only when submitted), the category as id and name, created_at and
    updated_at." (V1, V2, V3, V4, V5, V6, V7 happy path)

- [ ] T2. Omitting description clears it: 200 without a description key, stored null
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — seed a category and a prompt that
    **has** a description; PUT a body **without** `description`; assert status `200` and
    that `response.body` has **no** `description` property
    (`expect(response.body).not.toHaveProperty('description')`), and that
    `selectPromptsByIds` shows the persisted row's `description` is now `null` (cleared).
  - Green: no new code expected — the existing `UpdatePromptUseCase` returns a prompt whose
    `description` is `undefined` when omitted (and persists `null`), and T1's inline response
    mapping only adds a `description` key when `prompt.description !== undefined`. If the test
    reveals a gap, make the minimal handler change to satisfy it.
  - Covers: AC1 (the "description (only when submitted)" clause) "Given a well-formed request
    whose prompt and category both exist, When the client updates the prompt, Then ...
    contains the stored prompt: ... description (only when submitted) ..."

- [ ] T3. Changing the category updates and echoes the new category
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — seed **two** categories and a prompt
    in the first; PUT a body whose `category_id` is the **second** category; assert status
    `200` and `response.body.category` equals `{ id: <second id>, name: <second name> }`, and
    that `selectPromptsByIds` shows the row's `promptCategoryId` is now the second category.
    Cleanup both categories.
  - Green: no new code beyond T1 — the existing `UpdatePromptUseCase` looks up the new
    category and returns/persists it.
  - Covers: AC1 (the "category is replaced" clause) "... the stored prompt's title, prompt
    text, category, and description are replaced with the submitted values ... contains the
    stored prompt: ... the category as id and name ..."

- [ ] T4. Malformed path id is rejected as a 400 validation failure before any lookup
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — `PUT /prompts/not-a-uuid` with an
    otherwise well-formed body; assert status `400` and body equals `{ error:
    'RequestValidationError', message: 'Request Validation data failed', details: { params: {
    id: <reason string> } } }` (assert `details.params.id` is a non-empty string — proving
    the malformed id surfaces under `params`, not `body`, and gates before any existence
    check). Fails first before T1's schema validates `params.id`.
  - Green: no new code beyond T1 — `UpdatePromptSchema.params.id` (`z.uuid()`) drives the
    400; `validator.ts` already groups the issue under `params`.
  - Covers: AC2 (the malformed-path-`id` case) "Given a request with a malformed path `id`,
    ... When the client attempts to update a prompt, Then the request is rejected as a
    validation failure whose reasons name each offending field (by its snake_case name) with
    a human-readable reason grouped under its request part, and nothing is updated." (V1, E1)

- [ ] T5. Missing required body field is rejected as a 400 validation failure
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — PUT a valid uuid path `id` with a
    body omitting `title` (valid `prompt` + valid uuid `category_id`); assert status `400`
    and body equals `{ error: 'RequestValidationError', message: 'Request Validation data
    failed', details: { body: { title: <reason string> } } }` (assert `details.body.title` is
    a non-empty string). Fails first before T1's route/schema exist.
  - Green: no new code beyond T1 — `validateRequestMiddleware(UpdatePromptSchema)` + existing
    `errorMiddleware` produce this contract; the schema's required `title` drives it.
  - Covers: AC2 (the omitted-required-field case) "Given a request with ... an omitted or
    non-text required body field ..., When the client attempts to update a prompt, Then the
    request is rejected as a validation failure whose reasons name each offending field ...
    grouped under its request part, and nothing is updated." (V2, V3, E1)

- [ ] T6. Malformed category_id is rejected as 400 before the existence checks
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — PUT a valid uuid path `id` with a
    body whose `category_id` is a non-UUID string (e.g. `"not-a-uuid"`); assert status `400`
    and `details.body.category_id` is a non-empty reason string (the request-validation
    envelope, **not** the 404/422 envelopes), confirming V4 gates before any lookup. Fails
    first before T1's schema exists.
  - Green: no new code beyond T1 — `z.uuid()` on `category_id` drives the 400.
  - Covers: AC2 (the malformed-`category_id` case) "Given a request with ... a `category_id`
    that is not a well-formed identifier, ... Then the request is rejected as a validation
    failure ... and nothing is updated." (V4, E1)

- [ ] T7. Well-formed but unknown prompt id returns 404 prompt-not-found
  - Type: middleware
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — PUT a well-formed body to a valid
    uuid path `id` matching **no** seeded prompt (seed a category so the body's
    `category_id` is valid); assert status `404` and body equals `{ error:
    'PromptNotFoundError', message: \`Prompt not found: ${id}\` }`, and that no prompt with
    that id exists (`selectPromptsByIds` empty). Fails first because the current
    `errorMiddleware` maps `PromptNotFoundError` to the generic `500`, not `404`.
  - Green: add a branch to `src/middleware/errorMiddleware.ts` — `if (err instanceof
    PromptNotFoundError) { res.status(404).json({ error: err.name, message: err.message });
    return; }` (import `PromptNotFoundError` from
    `@src/modules/prompt/domain/errors/PromptNotFoundError.js`), placed before the generic
    `500` fallback.
  - Covers: AC3 "Given a well-formed request whose path `id` is a valid identifier that
    matches no existing prompt, When the client attempts to update a prompt, Then the request
    is rejected as a prompt-not-found failure that names the missing prompt, distinct from a
    validation failure and without per-field reasons, and nothing is updated." (V6, E2)

- [ ] T8. Well-formed but unknown category_id (existing prompt) returns 422 category-not-found
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — seed a category and a prompt in it;
    PUT a well-formed body to that prompt's id whose `category_id` is a valid uuid matching
    **no** seeded category; assert status `422` and body equals `{ error:
    'CategoryNotFoundError', message: \`Category not found: ${categoryId}\` }`, and that the
    row is unchanged (`selectPromptsByIds` still shows the original values). Passes without
    new code because `errorMiddleware` already maps `CategoryNotFoundError` → `422` (added by
    create-prompt); this test pins the behavior for the update path.
  - Green: no new code — existing `errorMiddleware` 422 branch handles it.
  - Covers: AC4 "Given a well-formed request whose prompt exists but whose `category_id` is a
    valid identifier that matches no existing category, When the client attempts to update a
    prompt, Then the request is rejected as a category-not-found failure that names the
    missing category, distinct from a validation failure and from a prompt-not-found failure
    and without per-field reasons, and nothing is updated." (V7, E3)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a well-formed request whose prompt and category both exist, When the client updates the prompt, Then the stored prompt's title, prompt text, category, and description are replaced with the submitted values and its last-updated moment is set to now, while its identifier and creation moment are preserved, and the response indicates the resource was updated successfully and contains the stored prompt: id, title, prompt text, description (only when submitted), the category as id and name, created_at and updated_at. | T1, T2, T3 |
| AC2 | Given a request with a malformed path `id`, an omitted or non-text required body field, or a `category_id` that is not a well-formed identifier, When the client attempts to update a prompt, Then the request is rejected as a validation failure whose reasons name each offending field (by its snake_case name) with a human-readable reason grouped under its request part, and nothing is updated. | T4, T5, T6 |
| AC3 | Given a well-formed request whose path `id` is a valid identifier that matches no existing prompt, When the client attempts to update a prompt, Then the request is rejected as a prompt-not-found failure that names the missing prompt, distinct from a validation failure and without per-field reasons, and nothing is updated. | T7 |
| AC4 | Given a well-formed request whose prompt exists but whose `category_id` is a valid identifier that matches no existing category, When the client attempts to update a prompt, Then the request is rejected as a category-not-found failure that names the missing category, distinct from a validation failure and from a prompt-not-found failure and without per-field reasons, and nothing is updated. | T8 |
| AC5 | Given a well-formed request whose prompt and category both exist but whose storage fails unexpectedly, When the client attempts to update a prompt, Then the client is told a generic internal error occurred, distinct from a validation, prompt-not-found, or category-not-found failure. | Existing coverage — `tests/integration/middleware/errorMiddleware.test.ts` "renders a generic internal error for a non-validation failure" already proves `errorMiddleware`'s generic `500` branch (E4), which `PromptUpdateError` and any other non-mapped error fall through to unchanged. No new task (a real-DB storage failure cannot be provoked deterministically in integration; the branch is proven in isolation). |
