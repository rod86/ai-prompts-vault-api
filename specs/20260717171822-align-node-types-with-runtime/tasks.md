# Tasks: Align development type definitions with the supported runtime
Plan: specs/20260717171822-align-node-types-with-runtime/plan.md

- [ ] T1. Bump `@types/node` to the supported runtime major
  - Type: tooling (dependency change)
  - Depends on: none
  - Red: none — this is a dev-dependency version bump with no logic to test; it is
    verified by a clean type-check rather than a unit/integration test (see
    testing-practices / spec-driven-development logic-less exception).
  - Green: update `@types/node` from `^20.14.10` to major `24` (latest stable `24.x`) in
    `package.json` `devDependencies` and reinstall so `package-lock.json` regenerates
    (e.g. `npm install -D @types/node@24`). Then run `npm run typecheck` and confirm it
    passes with no new errors; resolve any surfaced v24-typing issue before completing.
  - Covers: AC1 "Given the project's declared minimum supported runtime major version, When type-checking runs, Then it uses development runtime type definitions of that same major version and completes with no errors."; V1

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given the project's declared minimum supported runtime major version, When type-checking runs, Then it uses development runtime type definitions of that same major version and completes with no errors. | T1 |
