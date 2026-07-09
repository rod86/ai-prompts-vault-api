# Spec: Migrate shared cross-cutting capabilities to the new module structure
Status: IMPLEMENTED
Story: As a developer, I want the shared cross-cutting capabilities relocated into the project's current architecture structure so that new and migrated contexts can build on the canonical shared foundation, while the existing legacy copy keeps working unchanged.

## 1. Behavior

The application exposes three shared, cross-cutting capabilities that any business
area can reuse: a **current-time provider**, a **password hasher**, and a **database
connection provider**. Today they exist only in a legacy location that predates the
project's current architecture conventions.

Main flow:
- The three capabilities are made available in a new, canonical location that follows
  the project's current architecture guidelines (contracts separated from their
  concrete implementations).
- Each capability behaves **identically** to its legacy counterpart — same inputs,
  same outputs, no change in runtime behavior. This is a structural relocation, not a
  behavior change.
- A single composition entry point exposes ready-to-use instances of the three
  capabilities, so future contexts consume them from one place.

Coexistence flow (interim):
- The legacy copy of these capabilities remains present and **byte-for-byte unchanged**.
- The existing business areas (prompt, user, auth) continue to depend on the legacy
  copy and are **not modified** by this work.
- The new canonical copy and the legacy copy coexist until the business areas are
  migrated under separate, future instructions. Duplication is accepted for this period.

Out of scope (deferred to future specs):
- Introducing a random-identifier provider and removing direct identifier generation
  from the request edge.
- Migrating the prompt, user, or auth business areas onto the new shared location.
- Removing the legacy copy.

## 2. Fields

None. This feature introduces no new data fields, request payloads, or persisted
records; it relocates existing capabilities.

## 3. Validation rules

- **V1** — Each relocated capability must be reachable from the new canonical location
  and must preserve the same public surface (same operations and results) as its legacy
  counterpart.
- **V2** — Contracts (the abstract descriptions of each capability) must be kept
  separate from their concrete implementations, per the current architecture guidelines.
- **V3** — The legacy copy of the capabilities must remain unchanged, and the existing
  business areas must remain unchanged.
- **V4** — The project's automated quality gates (lint including architecture-boundary
  checks, type checking, and the full test suite) must pass after the relocation.

## 4. Error responses

None. This work introduces no new runtime error conditions or user-facing error paths;
the relocated capabilities keep the exact behavior — including any failures — of their
legacy counterparts.

## 5. Acceptance criteria

- **AC1** — *Current-time provider relocated.* Given the new canonical location, When
  the current-time provider is asked for the time, Then it returns the present moment,
  exactly as the legacy provider does. (covers V1, V2)
- **AC2** — *Database connection provider relocated.* Given the new canonical location,
  When the database connection provider is opened, reused, and closed, Then it opens a
  single reusable connection bound to the supplied schema, closes it on request, and is
  a safe no-op when closed without an open connection — exactly as the legacy provider
  does. (covers V1, V2)
- **AC3** — *Password hasher relocated.* Given the new canonical location, When a
  password is hashed and then compared, Then the hash is never the plaintext, a matching
  password compares true, and a non-matching password compares false — exactly as the
  legacy hasher does. (covers V1, V2)
- **AC4** — *Single composition entry point.* Given the new canonical location, When the
  shared composition entry point is loaded, Then it exposes ready-to-use instances of the
  current-time provider, the password hasher, and the database connection provider.
  (covers V1)
- **AC5** — *Legacy left intact.* Given the migration is complete, When the legacy copy
  and the existing business areas are inspected, Then they are unchanged and their tests
  still pass. (covers V3)
- **AC6** — *Quality gates pass.* Given the migration is complete, When the project's
  lint, type-check, and full test suite are run, Then all pass. (covers V4)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | How much should this migration change beyond relocating files (interface placement, adapter naming, folder flattening)? | Relocate and fix layer placement, but keep existing names (current-time provider and password hasher keep their names). | V2/AC1–AC3 require correct layer placement; names are preserved rather than renamed to the guideline's canonical example. |
| 2 | Should this spec also introduce a random-identifier provider (the guideline's canonical shared port) and adopt it, given identifiers are currently generated at the request edge? | Defer to its own spec. | Explicitly listed under §1 "Out of scope"; keeps this a pure relocation. |
| 3 | Since the legacy business areas stay as-is and still depend on the legacy copy, how should the new location relate to the legacy copy in the interim? | Coexist: the new location is a canonical duplicate; the legacy copy stays fully intact until business areas migrate later. | V3/AC5 require the legacy copy and business areas to be untouched; duplication is accepted for the interim (§1 Coexistence). |