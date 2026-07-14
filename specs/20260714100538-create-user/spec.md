# Spec: Create user
Status: READY TO IMPLEMENT
Story: As an API client, I want to create a user by submitting their name, email, and password so that the user is registered and returned to me as a stored user.

## 1. Behavior
Main flow:
1. The client submits a new user with a name, an email address, and a password.
2. The system checks the submitted details satisfy the input rules (§3).
3. The system confirms no existing user already uses the submitted email.
4. The system stores the user as a new record, assigning it its own identifier,
   securely storing the password (never as plain text), and recording when it was
   created and last updated.
5. The system returns the newly created user as a stored user: its identifier,
   name, email, and its creation and last-updated moments. The password is never
   included in the response. The response indicates a new resource was created.

Alternate flow (invalid input):
- If any submitted detail breaks an input rule (§3), the user is not created and
  the client is told the request failed validation, with a per-field reason for each
  offending field.

Alternate flow (email already in use):
- If the input is well-formed but the submitted email is already used by an existing
  user, the user is not created and the client is told the email is already in use.
  This is reported distinctly from an input-validation failure.

Alternate flow (unexpected failure):
- If storing the user fails unexpectedly (not an input or duplicate-email problem),
  the client is told a generic internal error occurred.

Out of scope: authentication/authorization (the endpoint is public self-registration
— Decision D5); logging the user in or issuing a token on creation; email
verification/confirmation; updating, listing, or deleting users; password-complexity
rules beyond a minimum length; trimming/normalization of the name or email;
idempotency beyond the email-uniqueness check.

## 2. Fields
All client-facing field names — both submitted and returned — are **snake_case**
(Decision D6). The single-word names (`name`, `email`, `password`, `id`) are unchanged;
only the timestamps differ from the domain (`createdAt`→`created_at`, `updatedAt`→`updated_at`).

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| name | Human-readable name of the user | text | Yes | — |
| email | The user's email address | text (email) | Yes | — |
| password | The user's plain-text password (used to derive the stored secret) | text | Yes | — |

Returned in addition to the above (assigned by the system, not submitted):
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier assigned to the new user | text (identifier) | Yes | — |
| created_at | Moment the user was created | date | Yes | — |
| updated_at | Moment the user was last updated | date | Yes | — |

<!-- password is submitted but NEVER returned (Decision D1). The response is exactly
{ id, name, email, created_at, updated_at }. -->

## 3. Validation rules
- **V1** — `name` is required and must be a non-empty text value (Decision D4).
- **V2** — `email` is required and must be a well-formed email address. A value that
  is not a well-formed email is an input-validation failure (→ E1), decided before any
  email-uniqueness check (Decision D3).
- **V3** — `password` is required and must be a text value of at least 8 characters
  (Decision D2).
- **V4** — The submitted `email` must not already be used by an existing user. A
  well-formed but already-used email is **not** an input-validation failure; it is the
  email-already-in-use condition (→ E2).

## 4. Error responses
- **E1 — Request validation failed.** Trigger: one or more submitted details break an
  input rule (V1–V3) — e.g. a missing/empty required field, a non-text value, a
  malformed email, or a too-short password. The client is told the request failed
  validation, with the offending fields each paired with a human-readable reason
  (keyed by their snake_case names), grouped under the body. The user is not created.
  Distinguished from E2/E3 by being labelled a request-validation failure and carrying
  per-field reasons.
- **E2 — Email already in use.** Trigger: input is well-formed but the submitted email
  is already used by an existing user (V4). The client is told the email is already in
  use, identifying it. The user is not created. Distinguished from E1 by being labelled
  an email-already-in-use failure with no per-field reasons, and from E3 by naming the
  conflicting email rather than a generic internal error.
- **E3 — Unexpected internal failure.** Trigger: storing the user fails for a reason
  other than E1/E2. The client is told a generic internal error occurred.
  Distinguished from E1/E2 by its internal-error label and the absence of both
  per-field reasons and an email reference.

## 5. Acceptance criteria
- **AC1** — Given a well-formed request whose email is not already in use, When the
  client creates a user, Then the user is stored with a newly assigned identifier, a
  securely stored (non-plain-text) password, and creation/last-updated moments, and the
  response indicates a new resource was created and contains the stored user: id, name,
  email, created_at and updated_at, and never the password. *(covers V1, V2, V3, V4
  happy path)*
- **AC2** — Given a request that omits a required field, sends a non-text value, sends
  a malformed email, or sends a password shorter than the minimum length, When the
  client attempts to create a user, Then the request is rejected as a validation failure
  whose reasons name each offending field (by its snake_case name) with a human-readable
  reason grouped under the body, and no user is stored. *(covers V1, V2, V3, E1)*
- **AC3** — Given a well-formed request whose email is already used by an existing user,
  When the client attempts to create a user, Then the request is rejected as an
  email-already-in-use failure that names the conflicting email, distinct from a
  validation failure and without per-field reasons, and no new user is stored.
  *(covers V4, E2)*
- **AC4** — Given a well-formed request whose email is free but whose storage fails
  unexpectedly, When the client attempts to create a user, Then the client is told a
  generic internal error occurred, distinct from a validation or email-already-in-use
  failure. *(covers E3)*

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | On success, what does the endpoint return? | Created status with the stored user (id, name, email, created_at, updated_at); the password is never returned — matching what the existing `RegisterUserUseCase` already returns. | §1 main flow step 5; §2 fields; AC1. |
| D2 | How is `password` validated at the input stage? | Required text of at least 8 characters; too-short → input-validation failure. | V3; E1; AC2. |
| D3 | How is `email` validated at the input stage? | Must be a well-formed email address; a malformed value is an input-validation failure, decided before the uniqueness check. | V2; E1; AC2 (malformed → E1) vs AC3 (well-formed duplicate → E2). |
| D4 | How is `name` validated at the input stage? | Required non-empty text; missing/empty → input-validation failure. | V1; E1; AC2. |
| D5 | Should the endpoint require authentication? | No — public self-registration, consistent with the existing (all public) endpoints; there is no auth middleware in the app today. | §1 Out of scope. |
| D6 | What casing do the client-facing (submitted and returned) field names use? | snake_case — `createdAt`→`created_at`, `updatedAt`→`updated_at` on the wire; single-word names (name, email, password, id) unchanged. The domain use case stays camelCase, so the HTTP handler maps at the boundary. | §2 Fields; AC1; plan §2/§3. |
| D7 | When the email is already in use, how does the endpoint respond? | Reject as an email-already-in-use failure with HTTP 422, reported distinctly from a validation failure and naming the conflicting email (mirrors how `CategoryNotFoundError` → 422 is handled in the prompt module). | §1 email-in-use flow; V4; E2; AC3; plan §3. |
