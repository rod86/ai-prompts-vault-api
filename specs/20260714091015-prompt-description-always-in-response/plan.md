# Plan: Always return the prompt description on create and update
Spec: specs/20260714091015-prompt-description-always-in-response/spec.md

## 1. Approach
The change lives entirely in the HTTP boundary. Both prompt handlers currently emit
`description` only when it is defined, via a conditional spread:

```ts
...(prompt.description !== undefined && { description: prompt.description }),
```

Replace that with an unconditional field that coalesces any empty description to
`null` using a truthiness check:

```ts
description: prompt.description || null,
```

Because the only falsy string is the empty string, `|| null` maps `undefined`, `null`,
and `''` to `null` while passing any non-empty text through unchanged — exactly the
spec's contract. No other layer changes: the use cases, the `Prompt` domain type, the
Drizzle repositories, and the request-validation schemas are untouched, so persistence
keeps distinguishing an omitted description (stored as no value) from an empty one
(stored as empty text). This reuses the handlers' existing inline snake_case mapping;
nothing new is introduced.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Create prompt handler | existing | `src/handlers/prompts/createPromptHandler.ts` | Replace the conditional `description` spread with `description: prompt.description \|\| null`. |
| Update prompt handler | existing | `src/handlers/prompts/updatePromptHandler.ts` | Same replacement. |
| Create handler integration test | existing | `tests/integration/handlers/prompts/createPromptHandler.test.ts` | Change the "not submitted" test to assert `description: null` is present; add an empty-string test asserting `null` in the response with `''` still persisted. |
| Update handler integration test | existing | `tests/integration/handlers/prompts/updatePromptHandler.test.ts` | Change the "omitted" test to assert `description: null` is present; change the empty-string test's response assertion from `''` to `null` (keep the persisted `''` assertion). |

## 3. Interfaces & contracts
- Create response (`201`) and update response (`200`) bodies now always include
  `description: string | null` (previously the key was absent when there was no
  description). Every other field is unchanged.
- No use-case, repository, or schema signature changes.

| E# | Domain error | Response the user sees |
|--|--|--|
| — | — | No error responses are added or changed (spec §4). |

## 4. Data & persistence
None. The feature touches no storage. Persistence behavior is explicitly preserved:
- An omitted description is still stored as no value (`null`).
- An empty-text description is still stored as empty text (`''`).
Only the returned representation collapses both to `null`.

## 5. Validation
None. No validation rule is added or changed (spec §3); the request schemas
(`src/routes/prompts.schema.ts`) are untouched.

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| — | — | — | — |

## 6. Dependency changes
none

## 7. Assumptions & risks
Assumptions:
1. The `Prompt.description` value reaching each handler is `string | undefined` (create
   use case) / `string | undefined` (update use case), so the only falsy value that
   `|| null` collapses besides `undefined`/`null` is the empty string `''` — consequence
   if wrong: a description that is genuinely falsy but meaningful could be nulled, but no
   such value exists for a text field other than `''`, which is the intended case.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Response can no longer distinguish a stored empty description from an absent one (both become `null`); a client relying on that distinction in these two responses breaks. | low | Client sees `null` instead of `''` on create/update | Chosen behavior per Decisions D1/D3; persistence still distinguishes the two, and the distinction remains observable through storage. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Create, description omitted | body without `description` | Response `description: null`; stored as no value (unchanged) | AC1 |
| Create, empty description | `description: ''` | Response `description: null`; stored as `''` (unchanged) | AC2 |
| Create, non-empty description | `description: 'x'` | Response `description: 'x'` (unchanged) | none (existing regression test) |
| Update, description omitted | body without `description` | Response `description: null`; stored as no value (unchanged) | AC3 |
| Update, empty description | `description: ''` | Response `description: null`; stored as `''` (unchanged) | AC4 |
| Update, non-empty description | `description: 'x'` | Response `description: 'x'` (unchanged) | none (existing regression test) |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| AC1 (create omitted → null) | §2 createPromptHandler; §8 row 1 |
| AC2 (create empty → null, persist ``''``) | §2 createPromptHandler; §4; §8 row 2 |
| AC3 (update omitted → null) | §2 updatePromptHandler; §8 row 4 |
| AC4 (update empty → null, persist ``''``) | §2 updatePromptHandler; §4; §8 row 5 |
| Field: description always present | §1; §3 response contract |
| §3 no validation change | §5 (empty) |
| §4 no error change | §3 error table (—) |
