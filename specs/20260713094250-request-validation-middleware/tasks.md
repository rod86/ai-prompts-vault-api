# Tasks: Request validation middleware
Plan: specs/20260713094250-request-validation-middleware/plan.md

- [x] T1. Install valibot (latest stable)
  - Type: dependency
  - Depends on: none
  - Red: none — dependency change (plan §6); no behavior to test yet.
  - Green: install the latest stable `valibot` (e.g. `npm install valibot`) so `package.json` records the resolved version.
  - Covers: enables V1/V2/V3 tooling; no AC directly.

- [x] T2. validator returns a success result with the normalized, declared-only parts
  - Type: middleware helper (unit)
  - Depends on: T1
  - Red: unit test `validator.test.ts` — given a composed schema declaring `params`, `query`, and `body` and a matching valid input, `validator(schema, input)` returns `{ success: true, data }` where `data` contains exactly those parts (coerced values), and given a schema that omits `query`, `data` has no `query` key even when the input supplies one. Fails: `validator` does not exist.
  - Green: `src/middleware/validateRequest/validator.ts` — `v.safeParse(schema, input)`, return `{ success: true, data: result.output }` on success; export `RequestSchema` / `ValidatorResult` / `ValidationDetails` types.
  - Covers: AC1 "Given an endpoint declaring rules for one or more request parts, When a request satisfies every declared rule, Then the endpoint runs and receives a normalized request containing exactly the declared parts with their normalized values, and nothing for undeclared parts"; V2.

- [x] T3. validator returns a grouped-errors failure result for an invalid request (no throw)
  - Type: middleware helper (unit)
  - Depends on: T1, T2
  - Red: extend `validator.test.ts` — given a schema (custom messages) and an input with an invalid `body` field and an invalid `query` value, `validator` returns `{ success: false, errors }` where `errors` groups reasons by part — `{ body: { <field>: reason }, query: { <field>: reason } }` — with no `params` key, and it does not throw. Fails: validator has no failure branch.
  - Green: in `validator`, on `!result.success` group `result.issues` → `{ part: { field: message } }` (part = `issue.path[0]`, omit empty parts, first issue per (part,field) wins) and return `{ success: false, errors: grouped }`.
  - Covers: V3 (contributes to AC2/E1 via T5).

- [x] T4. validateRequestMiddleware exposes the normalized request to the handler
  - Type: middleware (integration)
  - Depends on: T2
  - Red: integration test `validateRequestMiddleware.test.ts` — a throwaway Express app (`express.json()` + a route wired with `validateRequestMiddleware(schema)` + a handler that echoes `req.parsedRequest`); a valid request returns 200 with the parsed, declared-only parts. Fails: middleware does not exist.
  - Green: `src/middleware/validateRequest/validateRequestMiddleware.ts` (build `{params,query,body}`, call `validator`, on success set `req.parsedRequest = result.data` and `next()`); `src/types/express.d.ts` augmenting `Express.Request` with `parsedRequest?: unknown`.
  - Covers: AC1 "Given an endpoint declaring rules for one or more request parts, When a request satisfies every declared rule, Then the endpoint runs and receives a normalized request containing exactly the declared parts with their normalized values, and nothing for undeclared parts".

- [ ] T5. errorMiddleware renders the RequestValidationError contract on an invalid request
  - Type: middleware (integration)
  - Depends on: T3, T4
  - Red: integration test `errorMiddleware.test.ts` — throwaway app (`express.json()` + route with `validateRequestMiddleware(schema)` + handler + `errorMiddleware` mounted last); an invalid request returns 400 `{ error: 'RequestValidationError', message: 'Request Validation data failed', details: { <part>: { field: reason } } }` (only failing parts present) and the handler is never reached. Fails: no error handler → default 500/HTML.
  - Green: `src/middleware/validateRequest/RequestValidationError.ts` (`extends Error`, `name`, `details: ValidationDetails`); add the failed-result throw branch to `validateRequestMiddleware` (`if (!result.success) throw new RequestValidationError(result.errors)`); `src/middleware/errorMiddleware.ts` — `instanceof RequestValidationError` branch returning the 400 contract (`error` from `err.name`).
  - Covers: AC2 "Given an endpoint declaring rules, When a request has invalid values in one or more declared parts, Then the request is rejected as a validation failure whose reasons name each invalid field with a human-readable reason grouped under its request part (path parameters / query / body), omitting parts with no failures, and the endpoint logic does not run"; V1, E1.

- [ ] T6. errorMiddleware renders a generic internal error for a non-validation failure
  - Type: middleware (integration)
  - Depends on: T5
  - Red: extend `errorMiddleware.test.ts` — throwaway app with a route that throws a plain `Error` + `errorMiddleware`; the request returns 500 `{ error: 'InternalServerError', message: 'Internal server error' }` with no `details`. Fails: else branch missing.
  - Green: add the fallback branch to `src/middleware/errorMiddleware.ts`.
  - Covers: AC3 "Given a request whose handling raises an unexpected, non-validation error, When it is processed, Then the caller is told a generic internal error occurred, distinct from a validation failure and without per-field reasons"; E2.

- [ ] T7. Wire body parsing and the error handler into the app
  - Type: composition
  - Depends on: T4, T5, T6
  - Red: none — `src/app.ts` is pure composition; the existing `tests/integration/app.test.ts` (health + not-found contract) must still pass and typecheck stays clean (see testing-practices).
  - Green: in `src/app.ts` mount `express.json()` before the routers and `errorMiddleware` last, after `notFoundMiddleware`.
  - Covers: enables the body part of AC1 on real requests (decision D5); no new AC.

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given an endpoint declaring rules for one or more request parts, When a request satisfies every declared rule, Then the endpoint runs and receives a normalized request containing exactly the declared parts with their normalized values, and nothing for undeclared parts. | T2, T4 (body path enabled by T7) |
| AC2 | Given an endpoint declaring rules, When a request has invalid values in one or more declared parts, Then the request is rejected as a validation failure whose reasons name each invalid field with a human-readable reason grouped under its request part (path parameters / query / body), omitting parts with no failures, and the endpoint logic does not run. | T3, T5 |
| AC3 | Given a request whose handling raises an unexpected, non-validation error, When it is processed, Then the caller is told a generic internal error occurred, distinct from a validation failure and without per-field reasons. | T6 |
