# Spec: Remove the dedicated test for the shared composition entry point
Status: READY TO IMPLEMENT
Story: As a developer, I want the shared composition entry point's coverage strategy
corrected to match the project's testing convention, so that it is proven by static
analysis and by the tests of the capabilities it wires, instead of a redundant dedicated
test.

## 1. Behavior

Main flow:
- The single composition entry point that exposes ready-to-use instances of the
  current-time provider, the password hasher, and the database connection provider (added
  under the shared cross-cutting relocation work) is no longer exercised by a dedicated
  automated test.
- Its correctness is instead demonstrated by two things that already exist: the project's
  type-checking gate (confirms the exported shape matches what consumers expect) and the
  existing tests of each individual capability it wires together (each already proves that
  capability behaves correctly on its own).

Out of scope:
- Changing the behavior of the current-time provider, password hasher, or database
  connection provider themselves — untouched.
- Reopening or editing the already-completed relocation work's own historical record.

## 2. Fields

None. This work removes a test; it introduces no data fields, request payloads, or
persisted records.

## 3. Validation rules

- **V1** — The composition entry point's own behavior must be unchanged by this work —
  removing its dedicated test must not alter what it does.
- **V2** — Removing the dedicated test must not reduce overall confidence: the entry
  point's behavior must remain demonstrable through the project's type-checking gate and
  through the passing tests of each capability it wires.
- **V3** — The already-completed relocation work's own historical record must not be
  reopened or edited by this work.

## 4. Error responses

None. This work introduces no new runtime error conditions or user-facing error paths.

## 5. Acceptance criteria

- **AC1** — *Composition entry point unchanged.* Given the composition entry point's code,
  When it is inspected, Then it is unchanged from its previous state and still exposes the
  three ready-to-use instances. (covers V1)
- **AC2** — *No dedicated test remains.* Given the test suite, When it is inspected, Then
  no test exercises the composition entry point directly in isolation. (covers V2)
- **AC3** — *Coverage preserved by other means.* Given the project's quality gates, When
  type-checking and the existing tests of the three wired capabilities are run, Then they
  pass and demonstrate the entry point's correctness without a dedicated test. (covers V2)
- **AC4** — *Full quality gates pass.* Given the change is complete, When lint,
  type-checking, and the full test suite are run, Then all pass. (covers V1, V2)
- **AC5** — *Historical record untouched.* Given the change is complete, When the original
  relocation work's own documentation is inspected, Then it is unchanged. (covers V3)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should this fix edit the original relocation work's own spec/plan/tasks directly, since that work introduced the test? | No — that work is complete and its record is immutable; this fix is planned and executed entirely in this new, separate spec. | Drives §1 "out of scope" and V3/AC5. |
| 2 | Should the composition entry point itself change in any way (restructuring, renaming, new exports)? | No — only its test-coverage strategy changes; its own code is untouched. | Scopes §1 to test removal only; drives V1/AC1. |
