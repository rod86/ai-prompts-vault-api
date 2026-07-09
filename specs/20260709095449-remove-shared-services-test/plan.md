# Plan: Remove the dedicated test for the shared composition entry point
Spec: specs/20260709095449-remove-shared-services-test/spec.md

## 1. Approach

Delete `tests/unit/modules/shared/services.test.ts` — the dedicated test added for
`src/modules/shared/services.ts` (the shared composition root) by the earlier shared
cross-cutting relocation work. No production code changes: `src/modules/shared/services.ts`
itself is not touched. This follows the `testing-practices` skill's rule that a composition
root has no logic of its own and gets no dedicated test — `npm run typecheck` plus the
existing unit/integration tests of `DateTimeService`, `BcryptPasswordHasher`, and
`DatabaseClient` (all already passing, from that same relocation work) continue to prove
`services.ts` wires them correctly.

The original relocation work's own folder
(`specs/20260709091827-migrate-shared-to-modules/`) is `IMPLEMENTED` and immutable —
nothing under it is read for editing purposes or modified by this work; this plan
documents the change entirely on its own.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Composition-root test | existing | `tests/unit/modules/shared/services.test.ts` | Deleted — the composition root has no logic of its own, per `testing-practices`' "no logic, no test" rule. |
| Composition root | existing | `src/modules/shared/services.ts` | No change — untouched; only its test-coverage strategy changes. |

## 3. Interfaces & contracts

None — no code or interface changes; this is a test-removal only.

Error mapping: none — this work defines no error responses (spec §4).

| E# | Domain error | Response the user sees |
|--|--|--|
| — | none | none |

## 4. Data & persistence

None. No schema, table, column, or migration changes.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Composition entry point's own behavior unchanged | `git diff` on `src/modules/shared/services.ts` is empty before/after this work | — |
| V2 | Coverage preserved without a dedicated test | `npm run typecheck`; `tests/unit/modules/shared/infrastructure/DateTimeService.test.ts`, `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts`, `tests/integration/modules/shared/infrastructure/BcryptPasswordHasher.test.ts` all pass | — |
| V3 | Original relocation work's own record untouched | `git diff` shows no changes under `specs/20260709091827-migrate-shared-to-modules/` | — |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. No replacement test is added — the removal is the entire change — consequence if wrong: an alternate verification approach would need its own task.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Deleting the test could mask a future regression if `services.ts`'s exports silently change shape without breaking `tsc` | low | low | `tsc` still catches type mismatches for existing consumers; any future context wiring against these exports fails to compile if the shape changes incompatibly. |

## 8. Edge cases

None — this is a pure test removal, not a behavior change.

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | §2 composition-root row (no change); §5 V1 |
| V2 | §2 test-deletion row; §5 V2 |
| V3 | §1 "immutable"; §5 V3 |
| AC1 | §2 composition-root row (no change); §5 V1 |
| AC2 | §2 test-deletion row |
| AC3 | §5 V2 |
| AC4 | §5 V1 + V2 + V3 combined (lint/typecheck/test) |
| AC5 | §5 V3 |
