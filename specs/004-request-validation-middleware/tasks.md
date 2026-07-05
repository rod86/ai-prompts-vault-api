# Tasks: Request validation and consistent error responses

Plan: specs/004-request-validation-middleware/plan.md
Status: READY FOR REVIEW

- [x] T1. validateRequestParts returns parsed data for every provided part when all are valid
    - Red: `tests/unit/middleware/validateRequest/validation.test.ts` —
      schemas `{ params: z.object({ id: z.string() }), query: z.object({ category: z.string().optional() }) }`;
      request `{ params: { id: 'abc' }, query: {} }`; call
      `validateRequestParts(schemas, request)`; assert the result equals
      `{ valid: true, data: { params: { id: 'abc' }, query: {} } }`. Fails:
      `validateRequestParts` does not exist yet.
    - Green: create `src/middleware/validateRequest/validation.ts` per
      plan.md §3 — `RequestPart`, `RequestValidationIssue`, `RequestSchemas`,
      `RequestValidationResult`, and `validateRequestParts` iterating each
      `[part, schema]` pair, calling `schema.safeParse(request[part])`, and
      collecting successfully parsed values into `data`.
    - Covers: AC1 "Given an operation whose input satisfies every rule
      defined for it, When the request is handled, Then it proceeds and
      produces that operation's normal result, with no invalid-request
      notice."

- [x] T2. validateRequestParts combines issues from every invalid part, each prefixed by its part name
    - Red: same file as T1 — new `it`; schemas
      `{ params: z.object({ id: z.string() }), query: z.object({ category: z.string() }) }`;
      request `{ params: {}, query: {} }` (both parts invalid); call
      `validateRequestParts(schemas, request)`; assert the result is
      `{ valid: false, issues: [...] }` where `issues` has length 2 and
      contains exactly one entry with `field: 'params.id'` and one with
      `field: 'query.category'`, each with a non-empty `problem`. Fails:
      `validateRequestParts` does not yet accumulate issues across parts.
    - Green: in `validateRequestParts`'s loop, push
      `{ field: [part, ...issue.path].join('.'), problem: issue.message }`
      for every issue of every failing part (not stopping at the first
      failing part), returning `{ valid: false, issues }` once at least one
      part failed.
    - Covers: V1 "Every piece of input required for a given operation that
      fails that operation's own rules is reported as one issue naming
      which field it concerns and what was wrong with it."; V2 "When more
      than one piece of input fails at once — whether within one area of
      the request's input or spread across more than one area checked
      together for the same operation — every failing issue is reported
      together in the same response, never only the first one
      encountered."; AC2 "Given an operation whose input fails one of its
      rules, When the request is handled, Then the user is told the
      request was invalid (E1), naming the failing field and why."; AC3
      "Given an operation whose input fails more than one rule at once —
      including cases where the failing pieces belong to different areas
      of the request's input checked together — When the request is
      handled, Then the user is told about every failing field together in
      the same notice (E1), not only the first one found."

- [x] T3. validateRequestMiddleware calls next() and exposes parsed data via req.validated when every part is valid
    - Red: `tests/unit/middleware/validateRequest/validateRequestMiddleware.test.ts` —
      a mock `req = { params: { id: 'abc' }, query: {} }` (plain object, no
      Express app involved), a mock `res` (unused, can be an empty object),
      and `next = vi.fn()`; call
      `validateRequestMiddleware({ params: z.object({ id: z.string() }) })(req, res, next)`;
      assert `next` was called with no arguments and `req.validated` equals
      `{ params: { id: 'abc' } }`. Fails: `validateRequestMiddleware` does
      not exist yet.
    - Green: create `src/middleware/validateRequest/validateRequestMiddleware.ts`
      per plan.md §3 — calls `validateRequestParts` with
      `{ body: req.body, params: req.params, query: req.query }`; on
      `valid: true`, sets `req.validated = result.data` and calls `next()`.
      Add the `Request.validated` augmentation (declaration merging)
      alongside it.
    - Covers: AC1 (see T1 text above).

- [x] T4. validateRequestMiddleware responds 400 with combined issues directly, without calling next(), when any part is invalid
    - Red: same file as T3 — new `it`; mock
      `res = { status: vi.fn().mockReturnThis(), json: vi.fn() }`; schemas
      with both `params` and `query` invalid (as in T2); mock
      `req = { params: {}, query: {} }`; call
      `validateRequestMiddleware(schemas)(req, res, next)`; assert
      `res.status` was called with `400` and `res.json` was called with
      `{ message: 'The request was invalid.', issues: [...] }` containing
      both prefixed field entries (`params.id`, `query.category`), and
      assert `next` was never called.
    - Green: `validateRequestMiddleware`'s failure branch —
      `res.status(400).json({ message: 'The request was invalid.', issues: result.issues }); return;`
      (no `next()`, no throw, no separate error-handling middleware).
    - Covers: E1 "Malformed request"; AC2 (see T1 above); AC3 (see T2
      above).

- [x] T5. GET /prompts returns a malformed-request response for an invalid query, end-to-end
    - Red: `tests/integration/handlers/GetPromptsHandler.test.ts` — new `it`;
      using `supertest` against the real `app`, request
      `GET /prompts?category=a&category=b` (a repeated query key, which
      Express represents as an array, failing `GetPromptsQuerySchema`'s
      `category: z.string().optional()`); assert status `400` and the JSON
      body has a `message` and an `issues` array containing an entry whose
      `field` is `'query.category'`. Fails today: `GetPromptsHandler.ts`
      calls `GetPromptsQuerySchema.parse(req.query)` inline with nothing to
      turn the thrown `ZodError` into a `400` JSON body, so this request
      currently falls through to Express's own default error handling.
    - Green: register
      `validateRequestMiddleware({ query: GetPromptsQuerySchema })` on
      `GET /prompts` in `src/app.ts`; update `GetPromptsHandler.ts` to read
      `req.validated?.query` (cast to the schema's inferred type) instead
      of calling `GetPromptsQuerySchema.parse(req.query)` itself. No error
      middleware is registered anywhere.
    - Covers: AC2 (see T1 above).

- [x] T6. GET /prompts?category=<valid> still succeeds after migration (regression)
    - Red: no new test — the existing `it`s in
      `tests/integration/handlers/GetPromptsHandler.test.ts` (all added by
      `002-list-prompts`: ordering, empty list, category filter, no
      description) already fully specify `GET /prompts`'s valid-input
      behavior; confirm this suite is green before T5's wiring change and
      must remain green, unmodified, after it.
    - Green: none beyond T5 — `GetPromptsHandler.ts`'s migrated read of
      `req.validated?.query` must produce the exact same `{ categoryId }`
      value `ListPromptsUseCase` received before the refactor for any
      already-valid `category` query value.
    - Covers: AC1 (see T1 text above).

- [x] T7. GET /prompts/:id still succeeds and still 404s after migration (regression)
    - Red: no new test — `req.params.id` can never be malformed through
      real HTTP (Express always supplies path parameters as plain
      strings), so there is no new observable malformed-request case for
      this route; instead, the existing `it`s in
      `tests/integration/handlers/GetPromptHandler.test.ts` (added by
      `003-get-prompt`: full prompt returned, `404` on a missing id, `404`
      on a non-UUID-shaped id, no-description prompt) are the safety net —
      confirm this suite is green before this task's wiring change and must
      remain green, unmodified, after it.
    - Green: remove `GetPromptParamsSchema.parse(req.params)` from
      `GetPromptHandler.ts`; register
      `validateRequestMiddleware({ params: GetPromptParamsSchema })` ahead
      of `getPromptHandler` for `GET /prompts/:id` in `src/app.ts`; update
      the handler to read `req.validated?.params` (cast to the schema's
      inferred type) instead of parsing itself. Leave the handler's
      existing `try/catch` around `getPromptUseCase.invoke(...)` for
      `PromptNotFoundError` completely untouched.
    - Covers: AC1 (see T1 text above).

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | ----------------------------------------- | -------------------- |
| AC1 | Given an operation whose input satisfies every rule defined for it, When the request is handled, Then it proceeds and produces that operation's normal result, with no invalid-request notice. | T1, T3, T6, T7 |
| AC2 | Given an operation whose input fails one of its rules, When the request is handled, Then the user is told the request was invalid (E1), naming the failing field and why. | T2, T4, T5 |
| AC3 | Given an operation whose input fails more than one rule at once — including cases where the failing pieces belong to different areas of the request's input checked together — When the request is handled, Then the user is told about every failing field together in the same notice (E1), not only the first one found. | T2, T4 |
