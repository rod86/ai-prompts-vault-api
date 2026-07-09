# Spec: Give the shared database connection provider its own contract
Status: READY TO IMPLEMENT
Story: As a developer, I want the canonical shared database connection provider described by its own explicit contract — built from the current legacy provider as the behavioral reference — so that it follows the same interface-based pattern already used by every other capability in the system, with no change in runtime behavior.

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
- The composition entry point's own tests are removed: it holds no logic of its own
  (pure composition — instantiating and exposing ready-to-use capabilities), so per
  the project's established "no logic, no dedicated test" convention its correctness
  is proven by type-checking plus the tests of the capabilities it composes, not by a
  test of its own.

Out of scope (deferred / explicitly excluded):
- The legacy copy of the database connection provider, and the existing business
  areas that depend on it, are untouched — this work only shapes the new, canonical
  location.
- No new capability is introduced and no capability is renamed; this only adds a
  contract to something that already exists.

## 2. Fields

None. This feature introduces no new data fields, request payloads, or persisted
records; it adds a contract to an existing capability.

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
  provider in terms of its contract, not its concrete implementation.
- **V5** — The composition entry point has no dedicated tests of its own; its
  correctness is established by type-checking and by the tests of the capabilities
  it composes.
- **V6** — The legacy copy of the provider and the existing business areas remain
  unchanged.
- **V7** — The project's automated quality gates (lint including
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
  terms of the contract rather than the concrete implementation. (covers V4)
- **AC4** — *No dedicated test for pure composition.* Given the composition entry
  point holds no logic of its own, When its test suite is inspected, Then it has no
  dedicated test file — its correctness is proven by type-checking and by the tests
  of the capabilities it composes. (covers V5)
- **AC5** — *Legacy left intact.* Given the change is complete, When the legacy copy
  of the provider and the existing business areas are inspected, Then they are
  unchanged and their tests still pass. (covers V6)
- **AC6** — *Quality gates pass.* Given the change is complete, When the project's
  lint, type-check, and full test suite are run, Then all pass. (covers V7)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | The requested target ("latest specs plan") resolves to `specs/20260709091827-migrate-shared-to-modules`, whose `spec.md` is `Status: IMPLEMENTED` and therefore immutable — create a new spec folder instead of updating it in place? | Yes, create a new spec folder (cross-referencing the original). | This spec lives in its own new folder rather than amending the migration spec; §1 explicitly frames this as building on that spec's outcome, not reopening it. |
| 2 | Should the composition entry point's exported database connection provider be typed against the new contract (hiding non-contract members at the export boundary), or keep it typed as the concrete implementation (today's pattern)? | Type it against the contract. | V4/AC3 require the composition entry point to describe the provider via its contract. |
| 3 | Should this work touch only the new canonical location, or also retrofit the legacy copy that existing business areas depend on directly? | Only the new canonical location. | §1 "Out of scope" and V6/AC5 scope the legacy copy and business areas as untouched. |
| 4 | (User directive, given mid-interview) Also remove the composition entry point's own test file, since it has no logic of its own. | Remove it. | Added V5/AC4, and §1's main flow now states the composition entry point's tests are removed rather than merely updated. |
