# Plan: Request validation middleware
Spec: specs/20260713094250-request-validation-middleware/spec.md

## 1. Approach

Add a reusable Express middleware factory that validates a request's `params`,
`query`, and `body` against a single valibot schema declared per route, and
exposes the parsed result on `req.parsedRequest`. Validation lives in a small pure
`validator` function (kept out of the middleware file) that **returns a result** —
parsed data on success, grouped `{part:{field:reason}}` errors on failure — and
**never throws**. The middleware turns a failed result into a thrown
`RequestValidationError` carrying those grouped errors. A new central
`errorMiddleware` — the app's first error handler — turns that error into a `400`
with the agreed contract and turns any other error into a generic `500`.

The three pieces of the middleware live together under a `validateRequest/`
subfolder (the user's requested layout). This is HTTP-layer code, which sits
outside the `eslint-plugin-boundaries` element set (boundaries only govern
`src/modules/**`), so no hexagonal rule applies. Follows the `node-express-typescript`
skill's validation-factory + centralized-error-handler patterns, adapted to the
project's decisions (single composed schema per route, single `req.parsedRequest`
landing spot). It deliberately diverges from that skill on two points (composed
schema vs. per-target calls; `req.parsedRequest` vs. in-place write + `req.validatedQuery`)
— both are logged spec decisions D1/D2.

`app.ts` gains `express.json()` (so body rules are effective) and mounts
`errorMiddleware` last, after `notFoundMiddleware`.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `validateRequestMiddleware` | New | `src/middleware/validateRequest/validateRequestMiddleware.ts` | Factory `validateRequestMiddleware(schema)` → `RequestHandler`; builds `{ params, query, body }`, calls `validator`; on a failed result throws `RequestValidationError`, else assigns `req.parsedRequest = result.data` and calls `next()`. No valibot logic. `export default`. |
| `validator` + types | New | `src/middleware/validateRequest/validator.ts` | Pure `validator(schema, input)` → `ValidatorResult` (`{success:true,data}` \| `{success:false,errors}`); **never throws**. Owns the valibot `safeParse` and the issues→`{part:{field:reason}}` grouping. Exports the `RequestSchema` / `ValidatorResult` / `ValidationDetails` types. |
| `RequestValidationError` | New | `src/middleware/validateRequest/RequestValidationError.ts` | `extends Error`; `name = 'RequestValidationError'`; carries `details: ValidationDetails`. Thrown by the middleware (from a failed result), caught by `errorMiddleware`. |
| `errorMiddleware` | New | `src/middleware/errorMiddleware.ts` | 4-arg `(err, req, res, next)`. `RequestValidationError` → `400` contract; else → `500` generic. `export default`. |
| `Express.Request` augmentation | New | `src/types/express.d.ts` | `declare global` adds `parsedRequest?: unknown` to `Express.Request`. Picked up via tsconfig `include: ["src"]`. |
| App wiring | Existing | `src/app.ts` | Mount `express.json()` before routes; mount `errorMiddleware` last (after `notFoundMiddleware`). |
| Package manifest | Existing | `package.json` | Add `valibot` (latest stable). |

## 3. Interfaces & contracts

Signatures (valibot imported as `import * as v from 'valibot'`):

```
// validator.ts
type RequestSchema = v.GenericSchema<{ params?: unknown; query?: unknown; body?: unknown }>
type ValidationDetails = Partial<Record<'params' | 'query' | 'body', Record<string, string>>>
type ValidatorResult<S extends RequestSchema> =
    | { success: true; data: v.InferOutput<S> }     // data holds only the declared parts
    | { success: false; errors: ValidationDetails } // grouped {part:{field:reason}}
function validator<S extends RequestSchema>(schema: S, input: unknown): ValidatorResult<S>
//   never throws — always returns a discriminated result

// validateRequestMiddleware.ts
function validateRequestMiddleware(schema: RequestSchema): RequestHandler
//   const result = validator(schema, { params: req.params, query: req.query, body: req.body });
//   if (!result.success) throw new RequestValidationError(result.errors);
//   req.parsedRequest = result.data; next();

// RequestValidationError.ts (imports ValidationDetails from validator.ts)
class RequestValidationError extends Error {   // name = 'RequestValidationError'
    constructor(public readonly details: ValidationDetails)
}
```

Details mapping (in `validator`): run one `v.safeParse(schema, input)`. On success
return `{ success: true, data: result.output }`. On failure, group
`result.issues` by part = `issue.path[0]` (`params`/`query`/`body`); within a
part, key = the remaining path segments dot-joined (or the part name if nothing
remains), value = `issue.message`; first issue per (part, key) wins; parts with no
issues are omitted. Return `{ success: false, errors: grouped }`. The middleware
turns a failed result into `throw new RequestValidationError(result.errors)`.
valibot aggregates all part issues in the one parse, so a single failure lists
every offending field under its part.

Success write: `v.object(...)` strips keys not in the schema, so
`v.InferOutput<S>` (and thus `req.parsedRequest`) holds exactly the declared
parts (V2).

Wire contracts:

```
// E1 — RequestValidationError → 400 (parts with no failures omitted)
{ "error": "RequestValidationError",
  "message": "Request Validation data failed",
  "details": { "query": { "id": "<reason>" }, "body": { "<field>": "<reason>" } } }

// E2 — any other error → 500
{ "error": "InternalServerError", "message": "Internal server error" }
```

`errorMiddleware` uses `err.name` for the `error` label on the E1 branch and a
literal `'InternalServerError'` on the E2 branch (mirrors the existing
`notFoundMiddleware` `{ error, message }` style).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `RequestValidationError` | `400` `{ error: 'RequestValidationError', message: 'Request Validation data failed', details: { <part>: { field: reason }, ... } }` (empty parts omitted) |
| E2 | any non-validation `Error` | `500` `{ error: 'InternalServerError', message: 'Internal server error' }` |

## 4. Data & persistence

None — this feature touches no storage.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Each declared part satisfies its rules before the endpoint runs | `validator` (single `v.safeParse` of the composed schema) returns pass/fail; `validateRequestMiddleware` throws on a failed result before the handler | → E1 |
| V2 | Normalized result holds exactly the declared parts | `v.object` key-stripping; `req.parsedRequest = v.InferOutput<S>` | — |
| V3 | Failure names each invalid field with a reason, grouped by part; empty parts omitted | `validator` issues→`{part:{field:message}}` grouping | → E1 |

## 6. Dependency changes

| Dependency | Version | Action | Reason |
|--|--|--|--|
| valibot | latest stable | install | Schema definition + parsing/coercion + issue reporting for request validation |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. The `Express.Request` augmentation lives in `src/types/express.d.ts` and types
   `parsedRequest` as `unknown`; handlers narrow it via `v.InferOutput<typeof schema>`.
   Consequence if wrong: augmentation file relocated / typed differently — no
   behavior change.
2. Because no real route consumes the middleware yet (schemas arrive with future
   endpoints), the middleware/error-handler behavior (AC1–AC3) is proven via a
   small throwaway Express harness app per test (mounting `express.json()`, a
   route with `validateRequestMiddleware(schema)` + a handler, and
   `errorMiddleware`) rather than the real `src/app.ts`. This matches "test the
   shipped chain end to end" for a middleware with no consumer route. Consequence
   if wrong: tests restructured to use a demo route on the real app.
3. Test schemas use valibot custom messages (e.g. `v.string('name invalid')`) so
   `details` reasons are deterministic to assert; production reasons are whatever
   valibot/each endpoint's schema yields. Consequence if wrong: assertions loosen
   to "reason is a non-empty string".
4. The E2 generic message is the literal `'Internal server error'`. Consequence
   if wrong: string differs — no structural change.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Within a single part, one field raises multiple issues, so only the first reason is shown | low | A field with several problems reports just one reason at a time | First-issue-wins is deterministic; grouping by part already removes cross-part collisions (D6) |
| R2 | valibot's issue `path`/`message` shape differs from assumed | low | mapping breaks | A unit test asserts the mapped `details` shape against the installed version |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Body-only schema | Schema declares only `body`; request has extra query/params | Passes if body valid; `parsedRequest` has only `body` | AC1 |
| Multiple invalid parts | Invalid `query` value *and* invalid `body` field | Single 400; `details` has a `query` group and a `body` group, each listing its offending field; no `params` key | AC2 |
| Whole part wrong type | `body` is not an object at all | 400; `details.body` keyed by the part name (`body`) since no sub-path remains | AC2 |
| Undeclared parts stripped | Schema omits `query`; request has query values | `parsedRequest` has no `query` key | AC1 |
| Non-validation throw | Handler throws a plain `Error` | 500 generic contract, no `details` | AC3 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| V1 | §2 `validator` + `validateRequestMiddleware`; §5 V1 |
| V2 | §2 `req.parsedRequest`; §3 success write (`v.object` stripping); §5 V2 |
| V3 | §3 details mapping (strip part segment); §5 V3 |
| E1 | §2 `RequestValidationError` + `errorMiddleware`; §3 E1 contract |
| E2 | §2 `errorMiddleware`; §3 E2 contract |
| AC1 | §2 middleware + validator; §3 success write; §8 body-only / stripped cases |
| AC2 | §3 details mapping + E1 contract; §8 multiple-invalid / whole-part cases |
| AC3 | §2 `errorMiddleware` E2 branch; §3 E2 contract; §8 non-validation throw |
| Normalized request (field) | §3 `ValidatorResult.data` / `req.parsedRequest` |
| Field reason (field) | §3 details mapping |
| valibot dependency | §6 |
| App wiring (express.json + errorMiddleware) | §2 app.ts row |
