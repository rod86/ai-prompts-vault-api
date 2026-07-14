# Plan: Delete a prompt
Spec: specs/20260714093226-delete-prompt/spec.md

## 1. Approach
Add a `DELETE /prompts/:id` HTTP endpoint that reuses the already-implemented
`DeletePromptUseCase` (`src/modules/prompt/application/DeletePromptUseCase.ts`) and its
wired instance `deletePromptUseCase` (`src/modules/prompt/services.ts`). No business-logic
changes are needed — the work is purely in the HTTP layer, following the exact patterns of
the existing update endpoint: a request-validation schema, a thin handler, and a route
registration. Error mapping is already centralized in `errorMiddleware`.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `DeletePromptSchema` | new | `src/routes/prompts.schema.ts` | Add schema validating `params.id` as a UUID (same `error` shape as `UpdatePromptSchema.params`); export inferred `DeletePromptRequest` type |
| `deletePromptHandler` | new | `src/handlers/prompts/deletePromptHandler.ts` | Read `params.id` from `req.parsedRequest`, invoke `deletePromptUseCase`, respond `204` with no body |
| prompts router | existing | `src/routes/prompts.routes.ts` | Register `DELETE /prompts/:id` with `validateRequestMiddleware(DeletePromptSchema)` then `deletePromptHandler` |
| `deletePromptUseCase` | existing | `src/modules/prompt/services.ts` | Reused as-is; no change |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Reused as-is; already maps `PromptNotFoundError` → 404 and `RequestValidationError` → 400 |

## 3. Interfaces & contracts
- Route: `DELETE /prompts/:id`
- Success response: `204 No Content`, empty body.
- Use case call: `deletePromptUseCase.invoke({ id: params.id })` (existing `DeletePromptQuery`).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `PromptNotFoundError` (thrown by `DeletePromptUseCase`) | `404` `{ error: 'PromptNotFoundError', message: 'Prompt not found: <id>' }` (via existing `errorMiddleware`) |
| E2 | `RequestValidationError` (raised by `validateRequestMiddleware`) | `400` `{ error, message, details: { params: { id: 'Invalid UUID value' } } }` (via existing `errorMiddleware`) |

## 4. Data & persistence
None. The feature performs a delete through the existing repository; no schema, table, or
migration changes.

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `id` is a well-formed UUID | `validateRequestMiddleware(DeletePromptSchema)` on the route | → E2 |

## 6. Dependency changes
none

## 7. Assumptions & risks
Assumptions:
1. The `snake_case` wire convention leaves the path segment named `id` unchanged (matching `UpdatePromptSchema.params.id`) — consequence if wrong: handler would read the wrong param key; mitigated by copying the update endpoint's exact param shape.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Route ordering causes `/prompts/:id` to shadow another route | low | wrong handler invoked | Only `POST /prompts` and `PUT /prompts/:id` exist; `DELETE` method is distinct, no overlap |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Existing prompt | valid id of a stored prompt | `204`, row removed | AC1 |
| Unknown prompt | well-formed id matching no prompt | `404` `PromptNotFoundError` | AC2 |
| Malformed id | `id` not a UUID | `400` invalid-value on `params.id` | AC3 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| field `id` | §3 route `:id`, `DeletePromptSchema.params.id` |
| V1 | §5, `DeletePromptSchema` |
| E1 | §3 error map, `DeletePromptUseCase` + `errorMiddleware` |
| E2 | §3 error map, `validateRequestMiddleware` + `errorMiddleware` |
| AC1 | `deletePromptHandler` (204), route registration |
| AC2 | reuse of `deletePromptUseCase` + `errorMiddleware` |
| AC3 | `DeletePromptSchema` + `validateRequestMiddleware` |
