# Tasks: Create prompt
Plan: specs/20260713111541-create-prompt/plan.md

<!-- All business logic (CreatePromptUseCase, repository, category check) already exists
and is unit-tested; this feature is the HTTP layer only. Tasks are integration tests
(supertest + real DB) against src/app.ts, mirroring the listPromptCategoriesHandler
precedent. New POST tests all live in
tests/integration/handlers/prompts/createPromptHandler.test.ts. -->

- [x] T1. `POST /prompts` creates a prompt and returns 201 with the stored prompt
  - Type: route handler
  - Depends on: none
  - Red: new integration test `tests/integration/handlers/prompts/createPromptHandler.test.ts`
    — construct a `DatabaseClient<DatabaseSchema>` inline from `@src/config/config.js` +
    `@src/config/drizzle-schema.js` and call `databaseClient.connect()` (mirroring
    `listPromptCategoriesHandler.test.ts`); seed one category via the
    `tests/lib/database/promptCategories` helper (`insertPromptCategories`) using
    `promptCategoryModelFactory`; `request(app).post('/prompts').send({ title, prompt,
    category_id: <seeded id>, description })` (snake_case wire body). Assert status `201`
    and body equals `{ id: <any string>, title, prompt, description, category: { id, name },
    created_at, updated_at }` (snake_case keys; created_at/updated_at ISO strings, id
    present, and **no** camelCase `categoryId`/`createdAt`/`updatedAt` keys); then verify
    persistence with `selectPromptsByIds(db, [response.body.id])` (one row, matching
    `promptCategoryId`/`title`/`prompt`/`description`). Cleanup via `deletePromptsByIds`
    + `deletePromptCategoriesByIds` in `afterEach`. Fails first because no `POST /prompts`
    route exists (Express 404).
  - Green: create `src/routes/prompts.schema.ts` exporting `CreatePromptSchema =
    z.object({ body: z.object({ title: z.string(), prompt: z.string(), category_id:
    z.string().uuid(), description: z.string().optional() }) })` (snake_case wire names)
    and `type CreatePromptRequest = z.infer<typeof CreatePromptSchema>`; create
    `src/handlers/prompts/createPromptHandler.ts` (`const createPromptHandler:
    RequestHandler` → read `const { body } = req.parsedRequest as CreatePromptRequest`,
    map to the camelCase query `const prompt = await createPromptUseCase.invoke({ title:
    body.title, prompt: body.prompt, categoryId: body.category_id, description:
    body.description })`, then build the snake_case response inline and
    `res.status(201).json({ id: prompt.id, title: prompt.title, prompt: prompt.prompt,
    ...(prompt.description !== undefined && { description: prompt.description }), category:
    prompt.category, created_at: prompt.createdAt, updated_at: prompt.updatedAt })`;
    `export default`); add `promptsRouter.post('/prompts',
    validateRequestMiddleware(CreatePromptSchema), createPromptHandler)` in
    `src/routes/prompts.routes.ts`.
  - Covers: AC1 "Given a well-formed request whose category exists, When the client
    creates a prompt, Then the prompt is stored with a newly assigned identifier and
    creation/last-updated moments, and the response indicates a new resource was created
    and contains the stored prompt: id, title, prompt text, description (only when
    submitted), the category as id and name, created_at and updated_at." (V1, V2, V3, V4,
    V5 happy path)

- [x] T2. Omitting description returns 201 without a description key and stores null
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `createPromptHandler.test.ts` — seed a category, POST a body
    **without** `description`; assert status `201` and that `response.body` has **no**
    `description` property (`expect(response.body).not.toHaveProperty('description')`),
    and that `selectPromptsByIds` shows the persisted row's `description` is `null`.
    Fails first because the handler/use case does not yet exist (before T1) — after T1
    this proves the "only when submitted" clause. (If it already passes after T1, it
    still pins the behavior against regression.)
  - Green: no new code expected — the existing `CreatePromptUseCase` returns a prompt
    whose `description` is `undefined` when omitted, and T1's inline response mapping
    only adds a `description` key when `prompt.description !== undefined` (so it is
    omitted here); the repository stores `null`. If the test reveals a gap, make the
    minimal handler change to satisfy it.
  - Covers: AC1 (the "description (only when submitted)" clause) "Given a well-formed
    request whose category exists, When the client creates a prompt, Then ... contains
    the stored prompt: ... description (only when submitted) ..."

- [x] T3. Missing required field is rejected as a 400 validation failure
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `createPromptHandler.test.ts` — POST a body omitting `title`
    (valid `prompt` + valid uuid `category_id`); assert status `400` and body equals
    `{ error: 'RequestValidationError', message: 'Request Validation data failed',
    details: { body: { title: <reason string> } } }` (assert `details.body.title` is a
    non-empty string), and that no prompt was stored (query prompts for that category is
    empty). Fails first before T1's route/schema exist.
  - Green: no new code beyond T1 — `validateRequestMiddleware(CreatePromptSchema)` +
    existing `errorMiddleware` already produce this contract; the schema's required
    `title` drives it.
  - Covers: AC2 "Given a request that omits a required field, sends a non-text value, or
    sends a `category_id` that is not a well-formed identifier, When the client attempts
    to create a prompt, Then the request is rejected as a validation failure whose
    reasons name each offending field with a human-readable reason grouped under the
    body, and no prompt is stored." (V1, V2, E1)

- [ ] T4. Malformed category_id is rejected as 400 before the existence check
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `createPromptHandler.test.ts` — POST a well-formed body whose
    `category_id` is a non-UUID string (e.g. `"not-a-uuid"`); assert status `400` and
    `details.body.category_id` is a non-empty reason string (the request-validation
    envelope, **not** the 422 category-not-found envelope), confirming V3 gates before
    any category lookup. Fails first before T1's schema exists.
  - Green: no new code beyond T1 — `z.string().uuid()` on `category_id` drives the 400.
  - Covers: AC2 (the malformed-`category_id` case) "... or sends a `category_id` that is
    not a well-formed identifier, ... Then the request is rejected as a validation
    failure ... and no prompt is stored." (V3, E1)

- [ ] T5. Well-formed but unknown category_id returns 422 category-not-found
  - Type: middleware
  - Depends on: T1
  - Red: add an `it` to `createPromptHandler.test.ts` — POST a well-formed body whose
    `category_id` is a valid UUID that matches **no** seeded category; assert status
    `422` and body equals `{ error: 'CategoryNotFoundError', message: \`Category not
    found: <that id>\` }`, and that no prompt was stored. Fails first because the current
    `errorMiddleware` maps `CategoryNotFoundError` to the generic `500`, not `422`.
  - Green: add a branch to `src/middleware/errorMiddleware.ts` — `if (err instanceof
    CategoryNotFoundError) { res.status(422).json({ error: err.name, message:
    err.message }); return; }` (import `CategoryNotFoundError` from
    `@src/modules/prompt/domain/errors/CategoryNotFoundError.js`), placed before the
    generic `500` fallback.
  - Covers: AC3 "Given a well-formed request whose `category_id` is a valid identifier
    that matches no existing category, When the client attempts to create a prompt, Then
    the request is rejected as a category-not-found failure that names the missing
    category, distinct from a validation failure and without per-field reasons, and no
    prompt is stored." (V5, E2)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a well-formed request whose category exists, When the client creates a prompt, Then the prompt is stored with a newly assigned identifier and creation/last-updated moments, and the response indicates a new resource was created and contains the stored prompt: id, title, prompt text, description (only when submitted), the category as id and name, created_at and updated_at. | T1, T2 |
| AC2 | Given a request that omits a required field, sends a non-text value, or sends a `category_id` that is not a well-formed identifier, When the client attempts to create a prompt, Then the request is rejected as a validation failure whose reasons name each offending field (by its snake_case name) with a human-readable reason grouped under the body, and no prompt is stored. | T3, T4 |
| AC3 | Given a well-formed request whose `category_id` is a valid identifier that matches no existing category, When the client attempts to create a prompt, Then the request is rejected as a category-not-found failure that names the missing category, distinct from a validation failure and without per-field reasons, and no prompt is stored. | T5 |
| AC4 | Given a well-formed request whose category exists but whose storage fails unexpectedly, When the client attempts to create a prompt, Then the client is told a generic internal error occurred, distinct from a validation or category-not-found failure. | Existing coverage — `tests/integration/middleware/errorMiddleware.test.ts` "renders a generic internal error for a non-validation failure" already proves `errorMiddleware`'s generic `500` branch (E3), which `PromptCreationError` and any other non-mapped error fall through to unchanged. No new task (a real-DB storage failure cannot be provoked deterministically in integration; the branch is proven in isolation). |
