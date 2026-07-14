# Tasks: Update prompt
Plan: specs/20260713152201-update-prompt/plan.md

<!-- All business logic (UpdatePromptUseCase, repository, prompt/category checks) already
exists and is unit-tested; this feature is the HTTP layer only. Tasks are integration
tests (supertest + real DB) against src/app.ts, mirroring the createPromptHandler
precedent, and follow the UPDATED testing skills (spec D9):

- Fixtures (testing-practices): the shared parent category is a describe-scope const
  `fixtureCategory` (a second one `otherFixtureCategory` for the change-category test),
  built from `promptCategoryModelFactory`, inserted in `beforeAll` via
  `insertPromptCategories` and deleted in `afterAll` via `deletePromptCategoriesByIds`.
  The per-test prompt under test is `fixturePrompt` — generated with
  `promptModelFactory.create({ categoryId: fixtureCategory.id })` and inserted with
  `insertPrompts` INSIDE the `it` that uses it, then deleted with `deletePromptsByIds` at
  the end of that same test. Insert parent-before-child, delete child-before-parent. Only
  ever delete ids the test inserted — never truncate.
- Handler assertions (node-express-typescript §9 "Handlers"): assert the exact whole body
  with `toEqual` (using `expect.any(String)` for the generated timestamps) — never a
  partial match paired with a follow-up `not.toHaveProperty`. Verify persistence / no
  partial write with a direct `selectPromptsByIds` read.
- Request validation (node-express-typescript §9 "Handler request validation"): all
  validation cases live in a nested `describe('Request Validation')` block and assert ONLY
  the offending `details.<part>.<field>` reason (partial match, mirroring
  createPromptHandler.test.ts) — status and the full envelope are already pinned by the
  middleware's own test, so they are not re-asserted here.

The request-validation WIRE envelope is unchanged (D9): the shipped
`{ error, message, details: { <part>: { <field>: <reason> } } }`, reused from create-prompt.
The flat `{ errors: [...] }` shape in the updated skill is only an illustrative example of the
"assert only the involved fields" point, not a prescribed envelope.

All PUT tests live in tests/integration/handlers/prompts/updatePromptHandler.test.ts. -->

- [x] T1. `PUT /prompts/:id` updates a prompt and returns 200 with the stored prompt
  - Type: route handler
  - Depends on: none
  - Red: new integration test `tests/integration/handlers/prompts/updatePromptHandler.test.ts`
    — construct a `DatabaseClient<DatabaseSchema>` inline from `@src/config/config.js` +
    `@src/config/drizzle-schema.js`, `client.connect()`/`getConnection()` and
    `databaseClient.connect()` (mirroring `createPromptHandler.test.ts`). Declare the shared
    parent `const fixtureCategory = promptCategoryModelFactory.create()`; insert it in
    `beforeAll` (`insertPromptCategories(db, [fixtureCategory])`) and delete it in `afterAll`
    (`deletePromptCategoriesByIds(db, [fixtureCategory.id])`). In this `it`, generate the
    per-test child `const fixturePrompt = promptModelFactory.create({ categoryId:
    fixtureCategory.id })` and `await insertPrompts(db, [fixturePrompt])`;
    `request(app).put(\`/prompts/${fixturePrompt.id}\`).send({ title, prompt, category_id:
    fixtureCategory.id, description })` (snake_case wire body). Assert status `200` and
    `response.body` equals exactly `{ id: fixturePrompt.id, title, prompt, description,
    category: { id: fixtureCategory.id, name: fixtureCategory.name }, created_at:
    expect.any(String), updated_at: expect.any(String) }` (exact `toEqual`; snake_case keys,
    **no** camelCase `categoryId`/`createdAt`/`updatedAt`); assert `created_at` equals the
    seeded prompt's original `createdAt` (preserved) and `updated_at` differs from the seeded
    `updatedAt` (advanced); then verify persistence with `selectPromptsByIds(db,
    [fixturePrompt.id])` (one row, matching new `title`/`prompt`/`description`/
    `promptCategoryId`). Clean up with `deletePromptsByIds(db, [fixturePrompt.id])` at the end
    of the test. Fails first because no `PUT /prompts/:id` route exists (Express 404).
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

- [x] T2. Omitting description clears it: 200 whose exact body has no description key, stored null
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — inside the test, generate and insert
    a `fixturePrompt` that **has** a description (`promptModelFactory.create({ categoryId:
    fixtureCategory.id, description: '...' })`); PUT a body **without** `description`; assert
    status `200` and that `response.body` equals **exactly** (`toEqual`) `{ id, title, prompt,
    category: { id: fixtureCategory.id, name: fixtureCategory.name }, created_at:
    expect.any(String), updated_at: expect.any(String) }` — i.e. the whole body with **no**
    `description` key (the exact match proves absence; do **not** use a partial match +
    `not.toHaveProperty`). Verify `selectPromptsByIds` shows the persisted row's `description`
    is now `null` (cleared). Clean up `fixturePrompt`. This is the `null` (cleared → absent)
    nullable state.
  - Green: no new code expected — the existing `UpdatePromptUseCase` returns a prompt whose
    `description` is `undefined` when omitted (and persists `null`), and T1's inline response
    mapping only adds a `description` key when `prompt.description !== undefined`. If the test
    reveals a gap, make the minimal handler change to satisfy it.
  - Covers: AC1 (the "description (only when submitted)" clause) "Given a well-formed request
    whose prompt and category both exist, When the client updates the prompt, Then ...
    contains the stored prompt: ... description (only when submitted) ..."

- [x] T3. Empty-string description is set (not cleared): 200 with description '', stored ''
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — generate and insert a `fixturePrompt`;
    PUT a body whose `description` is the empty string `''`; assert status `200` and that
    `response.body` equals **exactly** (`toEqual`) the full prompt **including**
    `description: ''` (present, not omitted); verify `selectPromptsByIds` shows the persisted
    row's `description` is `''` (empty string, **not** `null`). Clean up `fixturePrompt`. This
    is the distinct empty-string (set → present) state, paired with T2's `null` state per the
    updated `testing-practices` guidance to cover each nullable state separately.
  - Green: no new code beyond T1 — `''` is a text value that passes `z.string()`, and the
    handler adds the `description` key because `'' !== undefined`; the use case persists `''`.
    If the test reveals a gap, make the minimal handler change to satisfy it.
  - Covers: AC1 (the "description ... replaced with the submitted values" clause) "... the
    stored prompt's title, prompt text, category, and description are replaced with the
    submitted values ..."

- [x] T4. Changing the category updates and echoes the new category
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — add a second shared parent
    `const otherFixtureCategory = promptCategoryModelFactory.create()` inserted/deleted
    alongside `fixtureCategory` in the `beforeAll`/`afterAll`; inside the test generate and
    insert a `fixturePrompt` in `fixtureCategory`; PUT a body whose `category_id` is
    `otherFixtureCategory.id`; assert status `200` and `response.body.category` equals `{ id:
    otherFixtureCategory.id, name: otherFixtureCategory.name }`, and that `selectPromptsByIds`
    shows the row's `promptCategoryId` is now `otherFixtureCategory.id`. Clean up
    `fixturePrompt`.
  - Green: no new code beyond T1 — the existing `UpdatePromptUseCase` looks up the new
    category and returns/persists it.
  - Covers: AC1 (the "category is replaced" clause) "... the stored prompt's title, prompt
    text, category, and description are replaced with the submitted values ... contains the
    stored prompt: ... the category as id and name ..."

- [x] T5. Request Validation — empty body reports every required field's missing-value reason
  - Type: route handler
  - Depends on: T1
  - Red: in a nested `describe('Request Validation')` in `updatePromptHandler.test.ts`, add an
    `it` — `PUT /prompts/<valid-uuid>` (a well-formed path id so only the body fails) with an
    empty body `{}`; assert `response.body.details.body` reports every required field together:
    `{ title: 'Missing required value', prompt: 'Missing required value', category_id: 'Missing
    required value' }` (partial match on `details.body`, mirroring
    createPromptHandler.test.ts). Do **not** re-assert the status or the full envelope (pinned
    by the middleware's own test). No fixtures — the request short-circuits before the handler.
    A non-text value for a required string field surfaces the same `invalid_type` →
    'Missing required value' reason, so this single case covers both the missing and non-text
    forms. Fails first before T1's route/schema exist.
  - Green: no new code beyond T1 — `validateRequestMiddleware(UpdatePromptSchema)` + the
    schema's required `title`/`prompt`/`category_id` drive it; existing `errorMiddleware`
    renders the `details` envelope.
  - Covers: AC2 (the omitted/non-text required-body-field case) "Given a request with ... an
    omitted or non-text required body field ..., When the client attempts to update a prompt,
    Then the request is rejected as a validation failure whose reasons name each offending
    field ... grouped under its request part, and nothing is updated." (V2, V3, V4-required, E1)

- [x] T6. Request Validation — malformed path id surfaces under details.params.id, before any lookup
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to the `Request Validation` describe — `PUT /prompts/not-a-uuid` with an
    otherwise well-formed body; assert `response.body.details.params` matches
    `{ id: 'Invalid UUID value' }` (partial match — proving the malformed id surfaces under
    `params`, not `body`, so it gates before any existence check). No fixtures; the request
    short-circuits. Status/full envelope not re-asserted (pinned by the middleware test).
    Fails first before T1's schema validates `params.id`.
  - Green: no new code beyond T1 — `UpdatePromptSchema.params.id` (`z.uuid()`) drives the
    validation failure; `validator.ts` already groups the issue under `params`.
  - Covers: AC2 (the malformed-path-`id` case) "Given a request with a malformed path `id`,
    ... When the client attempts to update a prompt, Then the request is rejected as a
    validation failure whose reasons name each offending field (by its snake_case name) with
    a human-readable reason grouped under its request part, and nothing is updated." (V1, E1)

- [x] T7. Request Validation — malformed category_id surfaces under details.body.category_id
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to the `Request Validation` describe — `PUT /prompts/<valid-uuid>` with a
    body whose `category_id` is a non-UUID string (e.g. `'not-a-uuid'`) and otherwise valid;
    assert `response.body.details.body` matches `{ category_id: 'Invalid UUID value' }`
    (partial match — this is the request-validation `details` envelope, confirming V4 gates
    before the 404/422 existence checks). No fixtures; short-circuits before the handler.
    Fails first before T1's schema exists.
  - Green: no new code beyond T1 — `z.uuid()` on `category_id` drives the validation failure.
  - Covers: AC2 (the malformed-`category_id` case) "Given a request with ... a `category_id`
    that is not a well-formed identifier, ... Then the request is rejected as a validation
    failure ... and nothing is updated." (V4, E1)

- [x] T8. Well-formed but unknown prompt id returns 404 prompt-not-found
  - Type: middleware
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — PUT a well-formed body to a valid
    uuid path `id` matching **no** seeded prompt (the body's `category_id` is
    `fixtureCategory.id`, so the category is valid); assert status `404` and `response.body`
    equals exactly `{ error: 'PromptNotFoundError', message: \`Prompt not found: ${id}\` }`,
    and that no prompt with that id exists (`selectPromptsByIds` empty — no partial write).
    No `fixturePrompt` is inserted. Fails first because the current `errorMiddleware` maps
    `PromptNotFoundError` to the generic `500`, not `404`.
  - Green: add a branch to `src/middleware/errorMiddleware.ts` — `if (err instanceof
    PromptNotFoundError) { res.status(404).json({ error: err.name, message: err.message });
    return; }` (import `PromptNotFoundError` from
    `@src/modules/prompt/domain/errors/PromptNotFoundError.js`), placed before the generic
    `500` fallback.
  - Covers: AC3 "Given a well-formed request whose path `id` is a valid identifier that
    matches no existing prompt, When the client attempts to update a prompt, Then the request
    is rejected as a prompt-not-found failure that names the missing prompt, distinct from a
    validation failure and without per-field reasons, and nothing is updated." (V6, E2)

- [x] T9. Precedence: prompt AND category both missing returns 404 prompt-not-found (E2 wins)
  - Type: route handler
  - Depends on: T8
  - Red: add an `it` to `updatePromptHandler.test.ts` — PUT a well-formed body to a valid uuid
    path `id` matching **no** seeded prompt AND a `category_id` that is a valid uuid matching
    **no** seeded category; assert status `404` and `response.body` equals exactly `{ error:
    'PromptNotFoundError', message: \`Prompt not found: ${id}\` }` (**not** `422`
    category-not-found) — pinning the deterministic precedence: existence (V6) is checked
    before the category reference (V7). No fixtures inserted. Passes once T8's `errorMiddleware`
    branch exists (the use case already checks the prompt before the category).
  - Green: no new code beyond T8 — the existing `UpdatePromptUseCase` throws
    `PromptNotFoundError` before it ever resolves the category.
  - Covers: AC3 (the "distinct from ..." / precedence clause) "... rejected as a
    prompt-not-found failure that names the missing prompt, distinct from a validation failure
    and without per-field reasons ..." (V6 before V7, E2)

- [x] T10. Well-formed but unknown category_id (existing prompt) returns 422 category-not-found
  - Type: route handler
  - Depends on: T1
  - Red: add an `it` to `updatePromptHandler.test.ts` — generate and insert a `fixturePrompt`
    in `fixtureCategory`; PUT a well-formed body to that prompt's id whose `category_id` is a
    valid uuid matching **no** seeded category; assert status `422` and `response.body` equals
    exactly `{ error: 'CategoryNotFoundError', message: \`Category not found: ${categoryId}\` }`,
    and that the row is unchanged — a direct `selectPromptsByIds` read still shows the original
    `title`/`prompt`/`description`/`promptCategoryId` (no partial write). Clean up
    `fixturePrompt`. Passes without new code because `errorMiddleware` already maps
    `CategoryNotFoundError` → `422` (added by create-prompt); this test pins the behavior for
    the update path.
  - Green: no new code — existing `errorMiddleware` 422 branch handles it.
  - Covers: AC4 "Given a well-formed request whose prompt exists but whose `category_id` is a
    valid identifier that matches no existing category, When the client attempts to update a
    prompt, Then the request is rejected as a category-not-found failure that names the
    missing category, distinct from a validation failure and from a prompt-not-found failure
    and without per-field reasons, and nothing is updated." (V7, E3)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a well-formed request whose prompt and category both exist, When the client updates the prompt, Then the stored prompt's title, prompt text, category, and description are replaced with the submitted values and its last-updated moment is set to now, while its identifier and creation moment are preserved, and the response indicates the resource was updated successfully and contains the stored prompt: id, title, prompt text, description (only when submitted), the category as id and name, created_at and updated_at. | T1, T2, T3, T4 |
| AC2 | Given a request with a malformed path `id`, an omitted or non-text required body field, or a `category_id` that is not a well-formed identifier, When the client attempts to update a prompt, Then the request is rejected as a validation failure whose reasons name each offending field (by its snake_case name) with a human-readable reason grouped under its request part, and nothing is updated. | T5, T6, T7 |
| AC3 | Given a well-formed request whose path `id` is a valid identifier that matches no existing prompt, When the client attempts to update a prompt, Then the request is rejected as a prompt-not-found failure that names the missing prompt, distinct from a validation failure and without per-field reasons, and nothing is updated. | T8, T9 |
| AC4 | Given a well-formed request whose prompt exists but whose `category_id` is a valid identifier that matches no existing category, When the client attempts to update a prompt, Then the request is rejected as a category-not-found failure that names the missing category, distinct from a validation failure and from a prompt-not-found failure and without per-field reasons, and nothing is updated. | T10 |
| AC5 | Given a well-formed request whose prompt and category both exist but whose storage fails unexpectedly, When the client attempts to update a prompt, Then the client is told a generic internal error occurred, distinct from a validation, prompt-not-found, or category-not-found failure. | Existing coverage — `tests/integration/middleware/errorMiddleware.test.ts` "renders a generic internal error for a non-validation failure" already proves `errorMiddleware`'s generic `500` branch (E4), which `PromptUpdateError` and any other non-mapped error fall through to unchanged. No new task (a real-DB storage failure cannot be provoked deterministically in integration; the branch is proven in isolation). |
