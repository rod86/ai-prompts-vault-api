# Plan: Get a prompt by id
Spec: specs/20260914105014-get-prompt-by-id/spec.md

## 1. Approach
Add a public `GET /prompts/:id` endpoint. The business logic already exists and is
unit-tested: `GetPromptUseCase` (`src/modules/prompt/application/GetPromptUseCase.ts`)
looks the prompt up through `PromptRepositoryInterface.findById` and throws
`PromptNotFoundError` when it is absent, and the instance `getPromptUseCase` is already
wired in `src/modules/prompt/services.ts` (currently unused by any handler). No
`domain`/`application`/`infrastructure` change is needed.

The work is therefore confined to the HTTP layer plus documentation, following the exact
shape of the existing delete endpoint (`src/handlers/prompts/deletePromptHandler.ts`,
`DeletePromptSchema`) for the params-only request, and the update endpoint
(`src/handlers/prompts/updatePromptHandler.ts`) for the response mapping — the response
body is identical, so `PromptResponseSchema`
(`src/routes/prompts/prompts.response.schema.ts`) is reused as-is (decision #2). The one
difference from every other `/prompts` route is that `requireAuthMiddleware` is **not**
mounted (decision #1), which also means the handler needs no `req.auth` guard and the
documented operation carries no `security` entry.

One test-infrastructure gap surfaced while exploring: `PromptModelFactory`
(`tests/lib/modelFactories/PromptModelFactory.ts`) always fills `description` via
`data.description ?? faker.lorem.sentence()`, so no fixture can currently persist a
prompt without a description. AC2 needs exactly that, so the factory is adjusted to
honour an explicitly passed `description: undefined` (assumption 2).

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `GetPromptSchema` | new | `src/routes/prompts/prompts.request.schema.ts` | Add `z.object({ params: z.object({ id: uuidField() }) })` mirroring `DeletePromptSchema`; export inferred `GetPromptRequest` type |
| `getPromptHandler` | new | `src/handlers/prompts/getPromptHandler.ts` | Read `params.id` from `req.parsedRequest`, invoke `getPromptUseCase`, respond `200` with the prompt mapped to the wire shape (`description` → `null` when absent, `Date` → `.toISOString()`) |
| prompts router | existing | `src/routes/prompts/prompts.routes.ts` | Register `promptsRouter.get('/prompts/:id', validateRequestMiddleware(GetPromptSchema), getPromptHandler)` — **no** `requireAuthMiddleware` |
| prompts API docs | existing | `src/docs/prompts.ts` | Add a `get` operation under the existing `'/prompts/{id}'` path item: no `security`, responses `200`/`400`/`404`/`429` |
| `PromptResponseSchema` | existing | `src/routes/prompts/prompts.response.schema.ts` | Reused as-is for the handler's `ResBody` type and the documented `200` body; no change |
| `getPromptUseCase` | existing | `src/modules/prompt/services.ts` | Reused as-is; no change |
| `errorMiddleware` | existing | `src/middleware/errorMiddleware.ts` | Reused as-is; already maps `PromptNotFoundError` (`NotFound`) → 404 and request-validation failures → 400 |
| `PromptModelFactory` | existing | `tests/lib/modelFactories/PromptModelFactory.ts` | Honour an explicitly provided `description: undefined` instead of substituting a faker value, so a description-less prompt can be persisted (test-only; needed by AC2) |

## 3. Interfaces & contracts
- Route: `GET /prompts/:id` — public (no `bearerAuth`), behind the global rate limiter like every other API route.
- Use case call: `getPromptUseCase.invoke({ id: params.id })` (existing `GetPromptQuery`).
- Success response: `200` with a `PromptResponse` body:

```
{
  id, title, prompt,
  description: string | null,
  category: { id, name },
  user: { id, name },
  created_at: ISO-8601, updated_at: ISO-8601
}
```

  — identical to the `POST /prompts` (201) and `PUT /prompts/:id` (200) bodies.
- Handler signature: `RequestHandler<Record<string, string>, PromptResponse>`, matching `updatePromptHandler`.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `PromptNotFoundError` (thrown by `GetPromptUseCase`) | `404` `{ status: 404, code: 'PROMPT_NOT_FOUND', message: 'Prompt not found: <id>' }` (via existing `errorMiddleware`) |
| E2 | request-validation failure (raised by `validateRequestMiddleware`) | `400` `{ status, code, message, details: { params: { id: 'Invalid UUID value' } } }` (via existing `errorMiddleware`) |

## 4. Data & persistence
None. The feature only reads through the existing `DrizzlePromptRepository.findById`; no
schema, table, or migration changes.

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `id` is a well-formed UUID | `validateRequestMiddleware(GetPromptSchema)` on the route, via the shared `uuidField()` (`src/routes/shared/fields.schema.ts`) | → E2 |

## 6. Dependency changes
none

## 7. Assumptions & risks
Assumptions:
1. The `snake_case` wire convention leaves the path segment named `id` unchanged, matching `DeletePromptSchema.params.id` — consequence if wrong: the handler reads the wrong param key; mitigated by copying the delete endpoint's exact param shape.
2. Adjusting `PromptModelFactory` to honour an explicitly passed `description: undefined` is backward-compatible: today no caller passes that key explicitly, so every existing test keeps receiving a faker-generated description — consequence if wrong: an unrelated test that relied on a description appearing despite passing the key explicitly starts seeing `undefined`; caught immediately by the full suite in the final verify step.
3. `description` is mapped to `null` with the same `prompt.description || null` expression used by `updatePromptHandler`/`createPromptHandler`, so a stored empty string is reported as empty exactly as those endpoints already do — consequence if wrong: the read result would disagree with the create/update result, breaking spec §1 step 3.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `GET /prompts/:id` shadows another GET route on the prompts router | low | wrong handler invoked | The only other GET is the literal `/prompt-categories`, a different path; Express 5 matches it exactly and it is registered first |
| R2 | Mounting the route publicly by accident weakens the other `/prompts` routes | low | unauthenticated writes | `requireAuthMiddleware` is per-route, not router-level; POST/PUT/DELETE keep their own middleware chains, and their existing tests assert 401 without a token |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Existing prompt, no credentials | valid id of a stored prompt, no `Authorization` header | `200` with the full prompt body | AC1 |
| Existing prompt, credentials supplied | valid id, a valid bearer token present | `200`, identical body — the header is ignored | AC1 |
| Prompt without a description | stored prompt whose description is absent | `200` with `description: null` | AC2 |
| Unknown prompt | well-formed id matching no prompt | `404` `PROMPT_NOT_FOUND` | AC3 |
| Malformed id | `id` is not a UUID | `400` with `details.params.id` = `'Invalid UUID value'` | AC4 |
| Documented response shape | valid id of a stored prompt | body satisfies `PromptResponseSchema` | AC5 |
| Documented operation | `GET /openapi.json` | `paths['/prompts/{id}'].get.responses` keys are exactly `200`, `400`, `404`, `429`, and the operation declares no `security` | AC6 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| input field `id` | §3 route `:id`, `GetPromptSchema.params.id` |
| returned fields (`id`, `title`, `prompt`, `description`, `category`, `user`, `created_at`, `updated_at`) | §3 success response, `getPromptHandler` mapping, reused `PromptResponseSchema` |
| V1 | §5, `GetPromptSchema` + `validateRequestMiddleware` |
| E1 | §3 error map, existing `GetPromptUseCase` + `errorMiddleware` |
| E2 | §3 error map, `validateRequestMiddleware` + `errorMiddleware` |
| AC1 | `getPromptHandler` (200) + route registration without `requireAuthMiddleware` |
| AC2 | `getPromptHandler` `description || null` mapping; `PromptModelFactory` adjustment |
| AC3 | reuse of `getPromptUseCase` + `errorMiddleware` |
| AC4 | `GetPromptSchema` + `validateRequestMiddleware` |
| AC5 | reused `PromptResponseSchema` as the handler's `ResBody` type |
| AC6 | `src/docs/prompts.ts` `get` operation under `'/prompts/{id}'` |
