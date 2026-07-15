# Plan: Uniform Error Envelope + Domain Error Classification
Spec: specs/20260715172739-ddd-error-envelope/spec.md

## 1. Approach

Introduce a single abstract business-error base, `DomainError`, in the shared context.
It carries two domain-owned classifiers: a stable `code` (public contract) and a
`category` (`'NotFound' | 'Forbidden' | 'Unauthorized' | 'Unprocessable'`). The eight
existing business error classes are re-parented to it, each declaring its `code` and
`category`, and dropping the manual `this.name` assignment (the base sets `name` from
`new.target.name`).

The HTTP layer owns protocol translation. A near-static `CATEGORY_STATUS` map
(`ErrorCategory → HTTP status`) lives in the middleware layer. `errorMiddleware` is
rewritten to three branches — invalid-request, `DomainError`, and a generic fallback —
importing **only** `DomainError`, `RequestValidationError`, and `CATEGORY_STATUS`; no
module error classes. `notFoundMiddleware` is updated to emit the same uniform envelope.

Per Decision 3, no `InfrastructureError` family is created: the technical-failure
classes (`PromptCreationError`, `PromptUpdateError`, `UserCreationError`,
`DatabaseNotConnectedError`) are left unchanged and are rendered by the generic fallback
branch, which also logs the underlying cause. Per Decision 4, handlers keep throwing;
mapping stays centralized in the middleware.

Reuses existing patterns: the current `src/middleware/errorMiddleware.ts` centralized
handler, the existing `RequestValidationError` (`src/middleware/validateRequest/`), and
the per-context `domain/errors/` folders.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `DomainError` base + `ErrorCategory` type | New | `src/modules/shared/domain/DomainError.ts` | Abstract `extends Error`; `abstract readonly code: string`; `abstract readonly category: ErrorCategory`; protected ctor sets `name = new.target.name`, forwards `cause` |
| `CATEGORY_STATUS` map | New | `src/middleware/domainErrorStatus.ts` | `{ NotFound: 404, Forbidden: 403, Unauthorized: 401, Unprocessable: 422 } satisfies Record<ErrorCategory, number>` |
| `errorMiddleware` | Existing | `src/middleware/errorMiddleware.ts` | Rewrite to 3 branches; import only `DomainError`, `RequestValidationError`, `CATEGORY_STATUS`; log cause on fallback |
| `notFoundMiddleware` | Existing | `src/middleware/notFoundMiddleware.ts` | Emit `{ status: 404, code: 'NOT_FOUND', message: 'Cannot <M> <path>' }` |
| `PromptNotFoundError` | Existing | `src/modules/prompt/domain/errors/PromptNotFoundError.ts` | `extends DomainError`; `code='PROMPT_NOT_FOUND'`, `category='NotFound'`; drop `this.name` |
| `PromptOwnershipError` | Existing | `src/modules/prompt/domain/errors/PromptOwnershipError.ts` | `extends DomainError`; `code='PROMPT_OWNERSHIP'`, `category='Forbidden'` |
| `CategoryNotFoundError` | Existing | `src/modules/prompt/domain/errors/CategoryNotFoundError.ts` | `extends DomainError`; `code='CATEGORY_NOT_FOUND'`, `category='Unprocessable'` |
| `EmailAlreadyInUseError` | Existing | `src/modules/user/domain/errors/EmailAlreadyInUseError.ts` | `extends DomainError`; `code='EMAIL_ALREADY_IN_USE'`, `category='Unprocessable'` |
| `InvalidCredentialsError` | Existing | `src/modules/auth/domain/errors/InvalidCredentialsError.ts` | `extends DomainError`; `code='INVALID_CREDENTIALS'`, `category='Unauthorized'` |
| `MissingTokenError` | Existing | `src/modules/auth/domain/errors/MissingTokenError.ts` | `extends DomainError`; `code='MISSING_TOKEN'`, `category='Unauthorized'` |
| `InvalidTokenError` | Existing | `src/modules/auth/domain/errors/InvalidTokenError.ts` | `extends DomainError`; `code='INVALID_TOKEN'`, `category='Unauthorized'` |
| `TokenExpiredError` | Existing | `src/modules/auth/domain/errors/TokenExpiredError.ts` | `extends DomainError`; `code='TOKEN_EXPIRED'`, `category='Unauthorized'` |
| `PromptCreationError` / `PromptUpdateError` / `UserCreationError` / `DatabaseNotConnectedError` | Existing | respective files | **No change** — remain plain `Error` subclasses, rendered by the generic fallback (E11) |

Test files updated to the new envelope (see §9): `errorMiddleware.test.ts`,
`app.test.ts`, `requireAuthMiddleware.test.ts`, `createPromptHandler.test.ts`,
`updatePromptHandler.test.ts`, `deletePromptHandler.test.ts`,
`createUserHandler.test.ts`, `authenticateHandler.test.ts`.

## 3. Interfaces & contracts

Shapes:

- `type ErrorCategory = 'NotFound' | 'Forbidden' | 'Unauthorized' | 'Unprocessable'`
- `abstract class DomainError extends Error { abstract readonly code: string; abstract readonly category: ErrorCategory; protected constructor(message, options?) }`
- `const CATEGORY_STATUS: Record<ErrorCategory, number>`
- Uniform success-of-error body: `{ status: number, code: string, message: string }`
- Invalid-request body: the above `+ details` (existing nested object)
- Generic fallback body: `{ status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' }`

Middleware branches (order):

```
if (err instanceof RequestValidationError)  → 400 { status:400, code:'VALIDATION_ERROR', message, details }
else if (err instanceof DomainError)        → CATEGORY_STATUS[category] { status, code, message }
else                                        → log cause; 500 { status:500, code:'INTERNAL_ERROR', message:'Internal server error' }
```

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `PromptNotFoundError` (`NotFound`) | 404 `{ status:404, code:'PROMPT_NOT_FOUND', message }` |
| E2 | `PromptOwnershipError` (`Forbidden`) | 403 `{ status:403, code:'PROMPT_OWNERSHIP', message }` |
| E3 | `CategoryNotFoundError` (`Unprocessable`) | 422 `{ status:422, code:'CATEGORY_NOT_FOUND', message }` |
| E4 | `EmailAlreadyInUseError` (`Unprocessable`) | 422 `{ status:422, code:'EMAIL_ALREADY_IN_USE', message }` |
| E5 | `InvalidCredentialsError` (`Unauthorized`) | 401 `{ status:401, code:'INVALID_CREDENTIALS', message }` |
| E6 | `MissingTokenError` (`Unauthorized`) | 401 `{ status:401, code:'MISSING_TOKEN', message }` |
| E7 | `InvalidTokenError` (`Unauthorized`) | 401 `{ status:401, code:'INVALID_TOKEN', message }` |
| E8 | `TokenExpiredError` (`Unauthorized`) | 401 `{ status:401, code:'TOKEN_EXPIRED', message }` |
| E9 | `RequestValidationError` (unchanged class) | 400 `{ status:400, code:'VALIDATION_ERROR', message, details }` |
| E10 | (no class — `notFoundMiddleware`) | 404 `{ status:404, code:'NOT_FOUND', message:'Cannot <M> <path>' }` |
| E11 | `PromptCreationError` / `PromptUpdateError` / `UserCreationError` / `DatabaseNotConnectedError` / any unknown | 500 `{ status:500, code:'INTERNAL_ERROR', message:'Internal server error' }`; cause logged |

## 4. Data & persistence

None. This feature touches no storage.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Body has exactly `status`/`code`/`message` (+`details` only for invalid-request) | `errorMiddleware` (branches), `notFoundMiddleware` | — |
| V2 | Body `status` equals transport status | `errorMiddleware`, `notFoundMiddleware` (single literal used for both `res.status(...)` and body `status`) | — |
| V3 | Technical/unknown failure reveals no internal detail; cause logged server-side | `errorMiddleware` generic fallback branch | → E11 |

## 6. Dependency changes

None.

## 7. Assumptions & risks

Assumptions:
1. Server-side cause logging uses `console.error(err)` (the codebase already logs via
   `console` in `src/index.ts`; no logger abstraction exists) — consequence if wrong:
   log destination/format differs, a one-line change.
2. `notFoundMiddleware` keeps its existing message text `Cannot <method> <path>`; only
   the surrounding shape changes — consequence if wrong: AC10 message wording differs.
3. Existing file/identifier names are kept (`errorMiddleware`, `notFoundMiddleware`);
   no rename to a `Handler` suffix in this refactor — consequence if wrong: extra rename
   churn, no behavior change.
4. `DomainError` and `ErrorCategory` are co-located in one file
   `src/modules/shared/domain/DomainError.ts` — consequence if wrong: a trivial file
   split.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A test asserts the old `{ error, message }` shape and is missed | low | red suite | §9 lists every asserting test; grep confirms the full set (8 files) |
| R2 | Re-parenting drops a subclass's `cause` forwarding on the two-arg technical errors | low | lost diagnostics | Technical errors are unchanged (Decision 3); only zero-`cause` business errors are re-parented |
| R3 | `boundaries` rejects a domain class importing the shared base | low | lint fail | Shared is importable from `domain` per the boundaries config; base lives in `shared/domain` |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Validation short-circuits handler | Invalid body on a validated route | 400 envelope with `details`; handler never runs | AC9 |
| Unknown business error reusing a category | (design) a new `Unprocessable` error added later | Renders via `CATEGORY_STATUS` with no middleware edit | none (open/closed invariant) |
| Technical failure from a use case | Repository throws during create | 500 generic envelope; cause logged; no internal wording | AC11 |
| Auth error thrown pre-handler | Missing/invalid/expired token in middleware | 401 envelope with the token `code` | AC6, AC7, AC8 |
| Body `status` mirrors transport | Any error | `res.status(n)` and body `status:n` share one literal | V2 (AC1, AC9) |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| Field `status`/`code`/`message` | §3 shapes; `errorMiddleware`, `notFoundMiddleware` |
| Field `details` | §3 invalid-request body; `errorMiddleware` validation branch |
| V1 | §5 V1; branch bodies |
| V2 | §5 V2; single-literal status |
| V3 | §5 V3; generic fallback + `console.error` |
| E1 | `PromptNotFoundError` re-parent; `CATEGORY_STATUS.NotFound` |
| E2 | `PromptOwnershipError` re-parent; `CATEGORY_STATUS.Forbidden` |
| E3 | `CategoryNotFoundError` re-parent; `CATEGORY_STATUS.Unprocessable` |
| E4 | `EmailAlreadyInUseError` re-parent; `CATEGORY_STATUS.Unprocessable` |
| E5 | `InvalidCredentialsError` re-parent; `CATEGORY_STATUS.Unauthorized` |
| E6 | `MissingTokenError` re-parent |
| E7 | `InvalidTokenError` re-parent |
| E8 | `TokenExpiredError` re-parent |
| E9 | `errorMiddleware` validation branch (unchanged `RequestValidationError`) |
| E10 | `notFoundMiddleware` rewrite |
| E11 | `errorMiddleware` generic fallback; technical errors unchanged |
| AC1–AC8 | `DomainError` base + `CATEGORY_STATUS` + respective re-parent + updated tests |
| AC9 | validation branch + updated `errorMiddleware.test.ts` |
| AC10 | `notFoundMiddleware` + updated `app.test.ts` |
| AC11 | generic fallback + updated `errorMiddleware.test.ts` |
