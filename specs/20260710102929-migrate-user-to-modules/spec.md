# Spec: Rebuild the user registration capability in the current module structure
Status: READY TO IMPLEMENT
Story: As a developer, I want the user account registration capability rebuilt inside the project's current module structure, coexisting with its existing implementation, so that a verified, current-standards foundation exists for retiring the existing implementation later.

## 1. Behavior

The user account registration capability — registering a new account from a name, an
email, and a password — is already fully specified by `008-user-registration`. This work
does not change what that capability does or how it behaves for a caller; it rebuilds its
internal implementation to follow the project's current architecture guidelines, and does
not yet replace the implementation the running application actually uses.

**Main flow:** Registration is rebuilt so that it produces the exact same result, in the
exact same situations, as it already does today — a new account is created from a name,
email, and password, and the created account is returned without its password, including
every error situation. The rebuilt version is not yet reachable by a caller; the existing
implementation keeps handling every registration request exactly as before.

**Alternate flow — identifier and timestamp assignment moves inside the capability:**
Today, when an account is registered, the account's unique identifier and its
creation/last-updated moment are handed to the capability from outside it. In the rebuilt
version, the capability produces these itself when registration happens. This is purely
internal: the values produced are still a unique identifier and the current date/time,
exactly as before — there is no observable difference in what a caller would see, and
since the rebuilt version isn't reachable yet, there is nothing to observe from outside at
all in this iteration.

**Coexistence flow (interim):** The existing implementation of this capability remains
present and unchanged, and keeps handling every registration request exactly as it does
today. The rebuilt version exists alongside it. Duplication is accepted for this period,
the same way it already was when the project's shared cross-cutting capabilities and its
prompt management capability were rebuilt ahead of this work.

**Shared account records:** The stored account records are read by more than one
capability — registration creates them, and the sign-in capability reads them to
authenticate. This work rebuilds only the registration capability; the stored account
records must remain available, unchanged, to every capability that reads them (in
particular the sign-in capability continues to authenticate against the same records).

**Out of scope (deferred to a future spec):**
- Making the rebuilt version the one that actually handles registration requests
  (retiring the existing implementation's wiring to the request edge).
- Removing the existing implementation.
- Rebuilding or otherwise migrating the sign-in / authentication capability, which reads
  the same account records.
- Any change to the fields returned to a caller, beyond what `008-user-registration`
  already defines.

## 2. Fields

None new. This work rebuilds the internal implementation of the field set already defined
for an account by `008-user-registration` — those fields, their meanings, and their
domain types are unchanged.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Account's unique identifier | text (unique id) | Yes | produced by the capability at registration |
| name | Account holder's display name | text | Yes | — |
| email | Account's email address (unique, case-insensitive) | text | Yes | — |
| password | Secret supplied at registration; stored only in secured form | text | Yes | — |
| createdAt | Moment the account was created | date | Yes | produced by the capability at registration |
| updatedAt | Moment the account was last updated | date | Yes | produced by the capability at registration |

## 3. Validation rules

- **V1** — Registration is reachable from the rebuilt implementation and, for the same
  inputs and the same underlying data, produces the same created account and the same
  errors as the existing implementation described in `008-user-registration`.
- **V2** — A registration attempt whose email already belongs to an existing account
  (compared case-insensitively) is rejected as a duplicate email, and no account is
  created — exactly as `008-user-registration` describes.
- **V3** — The account's unique identifier and its creation/last-updated moment are
  produced by the capability itself at registration time, not supplied to it from outside.
- **V4** — The password supplied at registration is never stored in readable form; it is
  stored only in secured (hashed) form, and it is never included in the account returned
  to the caller — exactly as `008-user-registration` describes.
- **V5** — Contracts (the abstract descriptions of the capability and its collaborators)
  are kept separate from their concrete implementations, per the current architecture
  guidelines.
- **V6** — The existing implementation, the other business areas, and the stored account
  records remain unchanged; every other capability that reads the account records (in
  particular sign-in) continues to read them exactly as before.
- **V7** — The project's automated quality gates (lint including architecture-boundary
  checks, type checking, and the full test suite) pass after the rebuild, and no change to
  stored data is required.

## 4. Error responses

- **E1** — *Duplicate email.* When registration targets an email that already belongs to
  an existing account (compared case-insensitively), the caller is told the email is
  already in use and no account is created. It is distinguished from other failures by
  naming the email-already-in-use condition, exactly as `008-user-registration` describes.

## 5. Acceptance criteria

- **AC1** — *Register a new account.* Given the rebuilt implementation, When an account is
  registered with a name, an email not already in use, and a password, Then a new account
  is created with a capability-assigned unique identifier and creation/last-updated moment,
  its password stored only in secured form, and the created account is returned without the
  password — exactly as `008-user-registration` describes. (covers V1, V3, V4)
- **AC2** — *Duplicate email rejected.* Given the rebuilt implementation, When an account
  is registered with an email that already belongs to an existing account (compared
  case-insensitively), Then the duplicate-email error (E1) is raised and no account is
  created, exactly as `008-user-registration` describes. (covers V2, E1)
- **AC3** — *Account records stored and found.* Given the rebuilt persistence adapter, When
  accounts are created and looked up by email, Then the same account rows are stored and the
  same account is found (case-insensitively), exactly as the existing adapter does. (covers
  V1, V2, V4)
- **AC4** — *Single composition entry point.* Given the rebuilt module, When its
  composition entry point is loaded, Then it exposes a ready-to-use registration capability
  wired to the shared current-time, secured-password, and unique-identifier providers.
  (covers V1, V3, V4)
- **AC5** — *Contracts separated.* Given the rebuilt module, When its structure is
  inspected, Then the capability's and its collaborators' contracts are placed separately
  from their concrete implementations, per the current architecture guidelines. (covers V5)
- **AC6** — *Legacy and shared records intact.* Given the rebuild is complete, When the
  existing implementation, the other business areas, and the stored account records are
  inspected, Then they are unchanged, the sign-in capability still authenticates against the
  same account records, and their existing tests still pass. (covers V6)
- **AC7** — *Quality gates pass, no data change.* Given the rebuild is complete, When the
  project's lint, type-check, and full test suite are run, Then all pass and no change to
  stored data is required. (covers V7)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | How far should this user-context migration go — rebuild-coexist (matching the shared/prompt precedent) or a full cutover in this same spec? | Rebuild coexisting: build the new module, leave the legacy user context, the request edge, and existing wiring untouched and still handling requests; defer retirement/rewiring to a later spec. | §1 Main/Coexistence flow and "Out of scope"; V6/AC6 require the legacy implementation, business areas, and stored records to be untouched (matches how shared and prompt were rebuilt). |
| 2 | In the rebuilt module, where should the new account's identifier and created/updated moments be produced? | Inside the capability: it injects the shared unique-identifier and current-time providers and produces them itself; the registration request drops the externally supplied id/created/updated values. | §1 "Alternate flow"; V3/AC1/AC4 require the capability to self-assign the identifier and timestamps, mirroring the rebuilt prompt module. |
