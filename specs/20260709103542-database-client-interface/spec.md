# Spec: Give the shared database connection provider its own contract, with no dedicated composition-root test

Status: IMPLEMENTED
Story: As a developer, I want the canonical shared database connection provider
described by its own explicit contract — built from the current legacy provider as
the behavioral reference — and the single composition entry point's coverage
strategy aligned with the project's "no logic, no dedicated test" convention, so
that it follows the same interface-based pattern already used by every other
capability in the system, with no change in runtime behavior, and its correctness
is proven by type-checking and by the tests of the capabilities it wires instead of
a redundant dedicated test.

This spec merges and supersedes two previously separate, overlapping spec folders:
`specs/20260709102334-database-client-interface/` and
`specs/20260709095449-remove-shared-services-test/` — both `READY TO IMPLEMENT`,
neither ever implemented. The second folder's entire scope (deleting
`tests/unit/modules/shared/services.test.ts`) was already a subset of the first
folder's T4/AC4. Both source folders are deleted as part of this merge (see §6
Decision 5); their content lives on here.

## 1. Behavior

The application's canonical shared location already offers a **database connection
provider** (relocated there by an earlier, now-completed migration) alongside a
current-time provider and a password hasher. Unlike those two, the connection
provider is not yet described by its own separately-stated contract — it is the one
capability in that location without one.

Main flow:
- The database connection provider's contract (what it does: open a connection bound
  to a supplied structure, close it) is stated explicitly and separately from its
  concrete implementation, exactly as already done for the current-time provider and
  the password hasher in the same location.
- The concrete provider's behavior does not change: opening, reusing, and closing a
  connection behaves exactly as it does today, including every existing edge case
  (reusing one connection across repeated opens, building a fresh one after a close,
  and safely no-op'ing a close when nothing is open).
- The single composition entry point that exposes the provider now describes it in
  terms of this contract, the same way it already describes the other two
  capabilities.
- The composition entry point's own dedicated test is removed and no replacement is
  added: it holds no logic of its own (pure composition — instantiating and exposing
  ready-to-use capabilities), so per the project's established "no logic, no
  dedicated test" convention its correctness is proven instead by type-checking plus
  the existing tests of each capability it wires together (the current-time
  provider's, the password hasher's, and the database connection provider's own
  tests).

Out of scope (deferred / explicitly excluded):
- The legacy copy of the database connection provider, and the existing business
  areas that depend on it, are untouched — this work only shapes the new, canonical
  location.
- No new capability is introduced and no capability is renamed; this only adds a
  contract to something that already exists, and corrects one file's test-coverage
  strategy.
- The composition entry point's own code is not changed beyond the contract-typed
  export (§1); its instantiation logic and the three capabilities it wires are
  otherwise untouched.
- Reopening or editing the already-completed relocation work's own historical record
  (`specs/20260709091827-migrate-shared-to-modules/`, `Status: IMPLEMENTED`).

## 2. Fields

None. This feature introduces no new data fields, request payloads, or persisted
records; it adds a contract to an existing capability and corrects a test-coverage
strategy.

## 3. Validation rules

- **V1** — The database connection provider's contract must declare the same
  operations (open a connection bound to a supplied structure; close it) as the
  concrete provider.
- **V2** — The contract is stated separately from its concrete implementation, per
  the current architecture guidelines — consistent with how the current-time
  provider and password hasher are already described.
- **V3** — The concrete provider's behavior is unchanged: same reuse-across-opens,
  fresh-connection-after-close, and safe-no-op-on-close-without-an-open-connection
  semantics as today.
- **V4** — The single composition entry point describes the database connection
  provider in terms of its contract, not its concrete implementation, and is
  otherwise unchanged (still exposes the same three ready-to-use instances).
- **V5** — The composition entry point has no dedicated test of its own; its
  correctness is established by type-checking and by the existing tests of the
  three capabilities it composes (`DateTimeService.test.ts`, `DatabaseClient.test.ts`,
  `BcryptPasswordHasher.test.ts`), which must all keep passing.
- **V6** — The legacy copy of the provider and the existing business areas remain
  unchanged.
- **V7** — The already-completed relocation work's own historical record
  (`specs/20260709091827-migrate-shared-to-modules/`) is not reopened or edited.
- **V8** — The project's automated quality gates (lint including
  architecture-boundary checks, type-checking, and the full test suite) pass.

## 4. Error responses

None. This work introduces no new runtime error conditions or user-facing error
paths; the provider keeps the exact behavior — including any failures — it has
today.

## 5. Acceptance criteria

- **AC1** — *Contract stated.* Given the new canonical location, When the database
  connection provider's contract is inspected, Then it declares the same operations
  (open a connection bound to a supplied structure, close it) as the concrete
  provider. (covers V1, V2)
- **AC2** — *Behavior unchanged.* Given the contract is in place, When the provider
  is opened, reused, and closed, Then it opens a single reusable connection bound to
  the supplied structure, closes it on request, and is a safe no-op when closed
  without an open connection — exactly as before. (covers V3)
- **AC3** — *Composition refers to the contract.* Given the single composition entry
  point, When it exposes the database connection provider, Then it is described in
  terms of the contract rather than the concrete implementation, and still exposes
  the same three ready-to-use instances. (covers V4)
- **AC4** — *No dedicated test for pure composition.* Given the composition entry
  point holds no logic of its own, When its test suite is inspected, Then it has no
  dedicated test file — its correctness is proven by type-checking and by the tests
  of the capabilities it composes. (covers V5)
- **AC5** — *Coverage preserved by other means.* Given the project's quality gates,
  When type-checking and the existing tests of the three wired capabilities
  (`DateTimeService.test.ts`, `DatabaseClient.test.ts`, `BcryptPasswordHasher.test.ts`)
  are run, Then they pass and demonstrate the entry point's correctness without a
  dedicated test. (covers V5)
- **AC6** — *Legacy left intact.* Given the change is complete, When the legacy copy
  of the provider and the existing business areas are inspected, Then they are
  unchanged and their tests still pass. (covers V6)
- **AC7** — *Historical record untouched.* Given the change is complete, When the
  original relocation work's own documentation
  (`specs/20260709091827-migrate-shared-to-modules/`) is inspected, Then it is
  unchanged. (covers V7)
- **AC8** — *Quality gates pass.* Given the change is complete, When the project's
  lint, type-check, and full test suite are run, Then all pass. (covers V8)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | -------------------- |
| 1 | The requested target ("latest specs plan") resolves to `specs/20260709091827-migrate-shared-to-modules`, whose `spec.md` is `Status: IMPLEMENTED` and therefore immutable — create a new spec folder instead of updating it in place? | Yes, create a new spec folder (cross-referencing the original). | This spec lives in its own new folder rather than amending the migration spec; §1 explicitly frames this as building on that spec's outcome, not reopening it. (Carried over from `20260709102334-database-client-interface`.) |
| 2 | Should the composition entry point's exported database connection provider be typed against the new contract (hiding non-contract members at the export boundary), or keep it typed as the concrete implementation (today's pattern)? | Type it against the contract. | V4/AC3 require the composition entry point to describe the provider via its contract. (Carried over from `20260709102334-database-client-interface`.) |
| 3 | Should this work touch only the new canonical location, or also retrofit the legacy copy that existing business areas depend on directly? | Only the new canonical location. | §1 "Out of scope" and V6/AC6 scope the legacy copy and business areas as untouched. (Carried over from `20260709102334-database-client-interface`.) |
| 4 | (User directive, given mid-interview) Also remove the composition entry point's own test file, since it has no logic of its own. | Remove it. | Added V5/AC4, and §1's main flow states the composition entry point's dedicated test is removed rather than merely updated. (Carried over from `20260709102334-database-client-interface`.) |
| 5 | Should this fix edit the original relocation work's own spec/plan/tasks directly, since that work introduced the test? | No — that work is complete and its record is immutable; this fix is planned and executed entirely in a separate spec. | Drives §1 "out of scope" and V7/AC7. (Carried over from `20260709095449-remove-shared-services-test`.) |
| 6 | Should the composition entry point itself change in any way (restructuring, renaming, new exports)? | No — only its test-coverage strategy and the contract-typed export change; its instantiation logic is untouched. | Scopes §1 to the contract-typed export plus test removal only; drives V4/AC3. (Carried over from `20260709095449-remove-shared-services-test`.) |
| 7 | (This merge) `20260709102334-database-client-interface` and `20260709095449-remove-shared-services-test` overlap almost entirely — the latter's whole scope (deleting `tests/unit/modules/shared/services.test.ts`) is already covered by the former's T4/AC4. Merge both into one new spec folder? | Yes. | This folder (`20260709103542-database-client-interface`) is the result; both source specs' decisions logs are preserved above (rows 1–6), and their acceptance criteria/validation rules are reconciled into §3/§5. |
| 8 | After merging, what should happen to the two source folders (`20260709102334-database-client-interface`, `20260709095449-remove-shared-services-test`)? | Delete both — neither was ever `IMPLEMENTED`, so nothing immutable is lost, and leaving stale duplicate `READY TO IMPLEMENT` folders around would confuse future `/spec-implement` auto-resolution. | Both source folders are removed from `specs/` as part of this planning session; this folder is now the sole record of the work. |
