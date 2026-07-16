# Plan: Unified boundary error (ApiError)
Spec: specs/20260716102945-api-error/spec.md

## 1. Approach

Introduce one concrete `ApiError` class at `src/errors/ApiError.ts` (a new
top-level home for express-side errors — the boundary-layer analogue of
`src/modules/*/domain/errors/`; one error per file). Boundary middleware
throws/forwards it inline with `(status, code, message, details?)`. The two
hand-written branches in `src/middleware/errorMiddleware.ts` (for
`RequestValidationError` and `RateLimitExceededError`) collapse into a single
`instanceof ApiError` branch that renders `{ status, code, message }` and adds
`details` only when it is neither `null` nor `undefined`.
`src/middleware/notFoundMiddleware.ts` stops hand-building its envelope and
forwards an `ApiError` via `next()` instead — centralizing all controlled
boundary rendering in `errorMiddleware`. The two legacy error classes are
deleted. The `DomainError` branch (`CATEGORY_STATUS` map in
`src/middleware/domainErrorStatus.ts`) and the generic 500 fallback are
untouched (spec §1 alternate flows).

Placement is linter-safe: `.eslintrc.json`'s `boundaries/elements` matches only
`src/modules/*/{domain,application,infrastructure}` and `src/modules/shared`,
so `src/errors/**` is unconstrained by `eslint-plugin-boundaries`.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `ApiError` | new | `src/errors/ApiError.ts` | Concrete `Error` subclass: `constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown)`; sets `this.name = 'ApiError'`. |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Replace the `RequestValidationError` and `RateLimitExceededError` branches (and their imports) with one `instanceof ApiError` branch; conditional `details` spread. |
| `validateRequestMiddleware` | existing | `src/middleware/validateRequest/validateRequestMiddleware.ts` | Throw `new ApiError(400, 'VALIDATION_ERROR', 'Request Validation data failed', result.errors)` instead of `RequestValidationError`. |
| `createRateLimitMiddleware` | existing | `src/middleware/rateLimit/createRateLimitMiddleware.ts` | `handler` forwards `next(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later.'))`. |
| `notFoundMiddleware` | existing | `src/middleware/notFoundMiddleware.ts` | Signature gains `next`; forwards `next(new ApiError(404, 'NOT_FOUND', \`Cannot ${req.method} ${req.path}\`))` instead of rendering directly. `app.ts` mounting order (`apiRouter` → `notFoundMiddleware` → `errorMiddleware`) already supports this — no `app.ts` change. |
| `RequestValidationError` | existing (delete) | `src/middleware/validateRequest/RequestValidationError.ts` | Deleted — replaced by `ApiError`. |
| `RateLimitExceededError` | existing (delete) | `src/middleware/rateLimit/RateLimitExceededError.ts` | Deleted — replaced by `ApiError`. |
| `errorMiddleware` tests | existing | `tests/integration/middleware/errorMiddleware.test.ts` | Add `ApiError` rendering cases (with/without `details`); the 429 case constructs `ApiError` directly (it currently imports the deleted `RateLimitExceededError`). Envelope assertions unchanged. |
| Express skill doc | existing | `.claude/skills/node-express-typescript/SKILL.md` | Document the `ApiError` pattern after the "Centralized error handler" section: thrown inline at the point of failure; `details` only for request-validation failures; extract a static factory if a code ever gains a second throw site. |

## 3. Interfaces & contracts

```ts
// src/errors/ApiError.ts
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// errorMiddleware — the single boundary branch (before the DomainError branch)
if (err instanceof ApiError) {
    res.status(err.status).json({
        status: err.status,
        code: err.code,
        message: err.message,
        ...(err.details != null && { details: err.details }),
    });
    return;
}
```

`err.details != null` (loose equality) covers both `null` and `undefined`, so
the `details` key is only ever added when a value is present (spec §1, AC4).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `ApiError(400, 'VALIDATION_ERROR', 'Request Validation data failed', details)` | `400 { status: 400, code: 'VALIDATION_ERROR', message, details }` |
| E2 | `ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later.')` | `429 { status: 429, code: 'TOO_MANY_REQUESTS', message }` |
| E3 | `ApiError(404, 'NOT_FOUND', \`Cannot ${method} ${path}\`)` | `404 { status: 404, code: 'NOT_FOUND', message }` |

## 4. Data & persistence

None.

## 5. Validation

No new validation rules (spec §3). Existing request-validation enforcement in
`validateRequestMiddleware` is unchanged; only the error it throws on failure
changes (→ E1).

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| — | (none new) | — | — |

## 6. Dependency changes

None.

## 7. Assumptions & risks

Assumptions — trivial silent decisions:
1. `this.name` is the constant `'ApiError'` (single concrete class, no
   subclass naming to preserve) — consequence if wrong: server-side logs show a
   generic name; cosmetic only.
2. Inline argument tuples at throw sites are acceptable while each code has
   exactly one throw site (true today: `VALIDATION_ERROR`,
   `TOO_MANY_REQUESTS`, `NOT_FOUND` each thrown once) — consequence if wrong:
   duplicated tuples drift; mitigated by the documented factory rule (skill
   doc, §2 last row).
3. The "details only on request-validation failures" envelope contract is
   enforced by convention/documentation, not by types (the generic constructor
   accepts `details` for any error) — consequence if wrong: a future caller
   attaches `details` to a non-validation error; caught in code review via the
   skill-doc rule.
4. The 404 message keeps its existing `Cannot ${req.method} ${req.path}`
   format (byte-identical responses) — consequence if wrong: none; pinned by
   the existing app-level test.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A caller constructs `ApiError` with status 500, masking the "internals never reach the client" guarantee of the generic fallback (status is a plain `number` by decision #4) | low | Confusing overlap with `INTERNAL_ERROR` contract | Skill-doc rule: `ApiError` is for controlled 4xx failures; unexpected failures are thrown raw and fall through to the generic 500. |
| R2 | Behavior drift during the swap (an envelope byte-changes) | low | Client-visible contract break | Existing integration tests pin every envelope (`errorMiddleware.test.ts`, `rateLimitMiddleware.test.ts`, `validateRequestMiddleware.test.ts`, `app.test.ts` 404 contract) and must stay green unmodified except the one deleted-class import. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No detail (undefined) | `new ApiError(s, c, m)` rendered | Reply has no `details` key at all | AC4 |
| Null detail | `new ApiError(s, c, m, null)` rendered | Reply has no `details` key at all (`!= null` guard) | AC4 |
| Detail present | `new ApiError(s, c, m, {field: '…'})` rendered | Reply includes `details` verbatim | AC5 |
| Unknown route with query string | `GET /nope?x=1` | Message uses `req.path` (no query): `Cannot GET /nope` | AC3 |
| Domain error thrown | e.g. `PromptNotFoundError` | Unchanged: `CATEGORY_STATUS` branch renders it; `ApiError` branch not involved | none (pinned by existing `errorMiddleware.test.ts` DomainError case) |
| Unexpected error thrown | `new Error('boom')` | Unchanged: generic `INTERNAL_ERROR` 500, cause logged server-side only | none (pinned by existing test) |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| E1 | §3 E-table row 1; §2 `validateRequestMiddleware` row |
| E2 | §3 E-table row 2; §2 `createRateLimitMiddleware` row |
| E3 | §3 E-table row 3; §2 `notFoundMiddleware` row |
| AC1 | §2 `validateRequestMiddleware` + `errorMiddleware` rows; R2 test pinning |
| AC2 | §2 `createRateLimitMiddleware` + `errorMiddleware` rows; R2 test pinning |
| AC3 | §2 `notFoundMiddleware` row; §8 query-string case |
| AC4 | §3 conditional-`details` contract; §8 undefined/null cases |
| AC5 | §3 conditional-`details` contract; §8 detail-present case |
| §1 "single central rendering step" | §2 `errorMiddleware` row; §1 approach |
| §1 alternate flows (out of scope) | §1 approach last paragraph; §8 domain/unexpected cases |
