# Plan: Echo empty prompt descriptions faithfully
Spec: specs/20260717171134-fix-empty-description-response/spec.md

## 1. Approach
The bug is confined to the HTTP response mapping in two handlers. Both build the
response body with `description: prompt.description || null`, where `||` collapses an
empty-string description (`''`) — a falsy value — to `null`. The domain
(`Prompt.description?: string`) and persistence already treat `''` as a distinct,
preserved value: `CreatePromptUseCase` returns `query.description` verbatim, and
`DrizzlePromptRepository.create` stores `prompt.description ?? null`, so `''` reaches
and stays in the database. Only the response lies.

Fix: replace the logical-OR fallback with the nullish-coalescing operator
(`prompt.description ?? null`) in both handlers, so only an *absent* description
(`undefined`) becomes `null`, while an empty string is echoed as `''`. This aligns the
create/update confirmation with what is persisted (and with any later read). No change
to schemas, use cases, the repository, validation, or the database. The response schema
already permits `''` (`description: z.string().nullable()`), so the emitted body still
validates.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| createPromptHandler | existing | `src/handlers/prompts/createPromptHandler.ts` | Line 29: `prompt.description \|\| null` → `prompt.description ?? null` |
| updatePromptHandler | existing | `src/handlers/prompts/updatePromptHandler.ts` | Line 30: `prompt.description \|\| null` → `prompt.description ?? null` |
| createPromptHandler integration test | existing | `tests/integration/handlers/prompts/createPromptHandler.test.ts` | Correct the empty-description case (~line 137) to assert the response body echoes `''`; rename it away from "returns description: null" |
| updatePromptHandler integration test | existing | `tests/integration/handlers/prompts/updatePromptHandler.test.ts` | Correct the empty-description case (~line 136) to assert the response body echoes `''` |

## 3. Interfaces & contracts
No signature changes. The response shape is unchanged:
`PromptResponse.description: z.string().nullable()` (`src/routes/prompts/prompts.response.schema.ts`)
already accepts `''` and `null`; the handlers keep returning `RequestHandler<…, PromptResponse>`.

| E# | Domain error | Response the user sees |
|--|--|--|
| — | none | No error paths added or changed |

## 4. Data & persistence
None. No table, column, migration, or mapping changes. Persistence already stores `''`
distinctly (`DrizzlePromptRepository.create`: `description: prompt.description ?? null`;
read-back: `row.description ?? undefined`), which this change leaves untouched.

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | A supplied `description` may be any text incl. empty, and empty is kept distinct from absent when echoed | Request validation (`prompts.request.schema.ts`, `description: z.string().optional()`) accepts any string incl. `''`; the response mapping in both handlers now uses `?? null` so only `undefined` → `null` | — (no error path) |

## 6. Dependency changes
none

## 7. Assumptions & risks
Assumptions:
1. No other read path re-collapses `''` — verified: only the create/update handlers use
   `|| null`; there is no wired list/get prompt handler. Consequence if wrong: another
   endpoint could still misreport `''`, out of scope here.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | The `?? null` change accidentally alters the "omitted" case | low | absent description wrongly echoed | `undefined ?? null === null` is preserved; AC3/AC4 (existing untouched tests) guard it |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Create, empty description | `description: ''` | Response `description: ''`; stored `''` | AC1 |
| Update, empty description | `description: ''` | Response `description: ''`; stored `''` | AC2 |
| Create, description omitted | no `description` key | Response `description: null`; stored `null` | AC3 |
| Update, description omitted | no `description` key | Response `description: null`; previous value cleared | AC4 |
| Create/update, non-empty description | `description: 'text'` | Response `description: 'text'` unchanged | none (existing behavior) |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| field `description` | §2 handlers; §3 response schema; §4 persistence |
| V1 | §1 approach; §2 handler edits; §5 validation row |
| AC1 | §2 create handler + create test; §8 case 1 |
| AC2 | §2 update handler + update test; §8 case 2 |
| AC3 | §2 create test (existing "not submitted" case); §8 case 3; R1 |
| AC4 | §2 update test (existing "omitted" case); §8 case 4; R1 |
