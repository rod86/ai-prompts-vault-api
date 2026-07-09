# Tasks: Remove the dedicated test for the shared composition entry point
Plan: specs/20260709095449-remove-shared-services-test/plan.md

- [ ] T1. Remove the composition entry point's dedicated test
  - Type: tooling
  - Depends on: none
  - Red: none — this task removes an existing test; there is no new code to cover. The
    check is that no test in the suite exercises `src/modules/shared/services.ts` directly
    afterward (confirmed by inspection/search, not a failing test).
  - Green: delete `tests/unit/modules/shared/services.test.ts`. `src/modules/shared/services.ts`
    itself is not modified.
  - Covers: AC1 "Given the composition entry point's code, When it is inspected, Then it is
    unchanged from its previous state and still exposes the three ready-to-use instances"
    (verified by `git diff` on the file being empty); AC2 "Given the test suite, When it is
    inspected, Then no test exercises the composition entry point directly in isolation"; V1, V2

- [ ] T2. Verify coverage is preserved and quality gates pass
  - Type: tooling
  - Depends on: T1
  - Red: none — verification-only task, no new code.
  - Green: run `npm run typecheck`, `npm run lint`, and `npm test`; confirm
    `tests/unit/modules/shared/infrastructure/DateTimeService.test.ts`,
    `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts`, and
    `tests/integration/modules/shared/infrastructure/BcryptPasswordHasher.test.ts` all still
    pass; confirm `git diff` shows no changes under
    `specs/20260709091827-migrate-shared-to-modules/`.
  - Covers: AC3 "Given the project's quality gates, When type-checking and the existing
    tests of the three wired capabilities are run, Then they pass and demonstrate the entry
    point's correctness without a dedicated test"; AC4 "Given the change is complete, When
    lint, type-checking, and the full test suite are run, Then all pass"; AC5 "Given the
    change is complete, When the original relocation work's own documentation is inspected,
    Then it is unchanged"; V1, V2, V3

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | *Composition entry point unchanged.* Given the composition entry point's code, When it is inspected, Then it is unchanged from its previous state and still exposes the three ready-to-use instances. | T1 |
| AC2 | *No dedicated test remains.* Given the test suite, When it is inspected, Then no test exercises the composition entry point directly in isolation. | T1 |
| AC3 | *Coverage preserved by other means.* Given the project's quality gates, When type-checking and the existing tests of the three wired capabilities are run, Then they pass and demonstrate the entry point's correctness without a dedicated test. | T2 |
| AC4 | *Full quality gates pass.* Given the change is complete, When lint, type-checking, and the full test suite are run, Then all pass. | T2 |
| AC5 | *Historical record untouched.* Given the change is complete, When the original relocation work's own documentation is inspected, Then it is unchanged. | T2 |
