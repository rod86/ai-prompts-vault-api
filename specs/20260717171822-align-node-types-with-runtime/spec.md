# Spec: Align development type definitions with the supported runtime
Status: READY TO IMPLEMENT
Story: As a maintainer of this project, I want the development runtime type definitions to match the major version of the runtime the project supports, so that type-checking reflects the APIs that are actually available at runtime and can catch real incompatibilities.

<!--
This is a tooling/developer-experience change with NO user-facing behavior: no endpoint,
field, validation, or error changes. Its "behavior" is expressed in terms of the
development type-checking surface, and its acceptance is proven by a clean type-check
(the logic-less verification path — see testing-practices / spec-driven-development),
not by a runtime test.
-->

## 1. Behavior
The project declares a minimum supported runtime major version. The development-time
type definitions used to type-check the codebase must correspond to that same runtime
major version.

Today those type definitions lag behind: they describe an older runtime major version
than the one the project requires, so type-checking validates against runtime APIs that
may not match what actually runs. After this change, the type definitions match the
project's declared minimum supported runtime major version, and type-checking continues
to pass cleanly against the existing source.

There is no change to any endpoint, request/response shape, stored data, or user-visible
behavior.

## 2. Fields
None — this change introduces no user-facing data.

## 3. Validation rules
- **V1** — The development runtime type definitions must be of the same major version as
  the project's declared minimum supported runtime; type-checking the existing source
  against them must succeed with no new errors.

## 4. Error responses
None. This change adds no error conditions.

## 5. Acceptance criteria
- **AC1** — Given the project's declared minimum supported runtime major version, When
  type-checking runs, Then it uses development runtime type definitions of that same
  major version and completes with no errors. (covers V1)

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should the runtime type-definition bump (report L1) be folded into the empty-description spec, be its own spec, or be done without a spec? | A separate spec folder, keeping each spec one coherent concern. | This standalone spec was authored for the type-definition alignment; the empty-description spec is untouched. |
