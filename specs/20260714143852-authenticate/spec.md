# Spec: Authenticate (login and get a token)
Status: IMPLEMENTED
Story: As a user, I want to submit my email and password and receive an access token so that I can use it to authenticate my subsequent requests.

## 1. Behavior
Main flow:
1. The user submits their email address and password.
2. The system checks the submitted details satisfy the input rules (§3).
3. The system confirms an account exists for the submitted email and that the
   submitted password matches that account's stored secret.
4. The system issues an access token identifying the account and returns it to the
   user.

Alternate flow (invalid input):
- If the email or password does not satisfy the input rules (§3) — for example a
  missing, empty, or malformed email, or a missing, empty, or too-short password — no
  token is issued and the user is told the request failed validation, with a per-field
  reason for each offending field.

Alternate flow (invalid credentials):
- If the input is well-formed but no account exists for the submitted email, or an
  account exists but the submitted password does not match, no token is issued and the
  user is told the credentials are invalid. The two cases (unknown email vs. wrong
  password) are reported identically and indistinguishably, so the response never
  reveals whether the email is registered. This is reported distinctly from an
  input-validation failure.

Out of scope: user registration (covered by the create-user feature); logout, token
refresh, or revocation; issuing the token on registration; multi-factor
authentication; account lockout or rate limiting after repeated failures; "remember
me" / configurable token lifetime chosen by the user; password-strength checks beyond a
minimum length (Decision D3); trimming or normalization of the submitted email;
returning any user profile data alongside the token.

## 2. Fields
All client-facing field names — both submitted and returned — are **snake_case**
(consistent with the rest of the API). The names used here (`email`, `password`,
`token`) are single-word and identical to their domain counterparts.

Submitted:
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| email | The email address identifying the account | text | Yes | — |
| password | The account's plain-text password, checked against the stored secret | text | Yes | — |

Returned on success:
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| token | An access token identifying the authenticated account | text | Yes | — |

<!-- The password is submitted but never returned. On success the response is exactly
{ token }. No user profile fields are returned (Decision D1). -->

## 3. Validation rules
- **V1** — `email` is required and must be a well-formed email address (Decision D3). A
  missing, empty, non-text, or malformed value is an input-validation failure (→ E1). A
  well-formed but unknown email passes this rule and is handled as invalid credentials
  (→ E2), not a validation failure.
- **V2** — `password` is required and must be a text value of at least 8 characters
  (Decision D3). A missing, empty, non-text, or too-short value is an input-validation
  failure (→ E1).

## 4. Error responses
- **E1 — Request validation failed.** Trigger: `email` or `password` breaks an input
  rule (V1, V2) — a missing, empty, non-text, or malformed email, or a missing, empty,
  non-text, or too-short password. The user is told the request failed validation, with
  the offending fields each paired with a human-readable reason (keyed by their
  snake_case names), grouped under the body. No token is issued. Distinguished from E2 by
  being labelled a request-validation failure and carrying per-field reasons.
- **E2 — Invalid credentials.** Trigger: input is well-formed (passes V1, V2) but either
  no account exists for the submitted email or the submitted password does not match the
  account's stored secret. The user is told the credentials are invalid, with a single
  generic message that does not reveal which of the two conditions occurred. No token is
  issued. Distinguished from E1 by being labelled an invalid-credentials failure with no
  per-field reasons.

## 5. Acceptance criteria
- **AC1** — Given a well-formed request whose email identifies an existing account and
  whose password matches that account's stored secret, When the user authenticates, Then
  an access token identifying the account is issued and returned as `{ token }`, and no
  other data (and never the password) is returned. *(covers V1, V2 happy path)*
- **AC2** — Given a request that omits, sends an empty/non-text, or sends a malformed
  `email`, or omits, sends an empty/non-text, or sends a shorter-than-minimum-length
  `password`, When the user attempts to authenticate, Then the request is rejected as a
  validation failure whose reasons name each offending field (by its snake_case name)
  with a human-readable reason grouped under the body, and no token is issued. *(covers
  V1, V2, E1)*
- **AC3** — Given a well-formed request whose email does not identify any existing
  account, When the user attempts to authenticate, Then the request is rejected as an
  invalid-credentials failure with a generic message, distinct from a validation failure
  and without per-field reasons, and no token is issued. *(covers E2, unknown email)*
- **AC4** — Given a well-formed request whose email identifies an existing account but
  whose password does not match that account's stored secret, When the user attempts to
  authenticate, Then the request is rejected as an invalid-credentials failure whose
  response is identical to the unknown-email case (AC3) — revealing nothing about which
  condition occurred — and no token is issued. *(covers E2, wrong password)*

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | What route/verb should the login endpoint use, and what does it return on success? | `POST /authenticate`, returning a success response with exactly `{ token }` (no user profile fields, no password). | §1 main flow step 4; §2 returned field; AC1; plan §2/§3. |
| D2 | How strictly should the endpoint validate the submitted email and password before checking credentials? | Presence only — `email` and `password` must each be present, non-empty text; no email-format or password-length checks. Missing/empty → validation failure (E1); anything present but wrong → invalid credentials (E2). Avoids leaking the registration password policy and treats a malformed vs. merely-unknown email uniformly at the credentials step. *(Superseded by D3.)* | §1 Out of scope; V1; V2; E1; E2; AC2; AC3; plan §5. |
| D3 | Follow-up: the endpoint should instead use full format checks — the same validation shape as create-user (`email` a well-formed address, `password` at least 8 characters). | **Supersedes D2.** `email` must be a well-formed email address (missing/non-text → "Missing required value", malformed → "Invalid email value"); `password` must be text of at least 8 characters (too-short → "Must be at least 8 characters"). A malformed email or too-short password is now a validation failure (E1), not a credentials check. A well-formed but unknown email still passes validation and yields invalid credentials (E2). Consequence accepted: the input stage reveals the password-length policy, and a malformed email returns a validation failure rather than a uniform invalid-credentials response. | §1 invalid-input flow & Out of scope; V1; V2; E1; AC2; plan §1/§2/§3/§5/§7/§8; tasks T3, T4. |
