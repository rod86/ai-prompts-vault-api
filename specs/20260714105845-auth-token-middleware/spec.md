# Spec: Authentication guard for protected actions
Status: READY TO IMPLEMENT
Story: As an API consumer, I want to attach my authentication token to a request for a protected action so that the API confirms my identity and rejects any request that lacks a valid, unexpired token.

## 1. Behavior

**Main flow.** A caller performs a protected action and supplies an
authentication token with the request. The system confirms the token is
authentic (issued by this system and unaltered) and not expired, reads the
identity (the caller's user id) the token represents, and lets the action
proceed with that identity available to it.

**Alternate flows.**
- **No token.** The request carries no authentication token. The action is not
  performed; the caller is told the request is not authenticated.
- **Expired token.** The token is authentic but its validity period has passed.
  The action is not performed; the caller is told specifically that the token
  has expired (so a client can tell it needs to obtain a fresh token).
- **Invalid token.** The token is unreadable, not authentic, or does not
  identify a user. The action is not performed; the caller is told the token is
  invalid.

In every rejection case no identity is made available and the protected action
does not run.

_Scope note: this feature defines and delivers the reusable guard behavior._
_Which specific actions are protected is decided per action and is out of scope_
_here — no existing action is placed behind the guard by this feature._

## 2. Fields

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| authentication token | Credential supplied with a request that identifies the caller | text | Yes, for a protected action | — |
| caller identity | The user id carried by a valid token, made available to the action once authenticated | object holding a user id (text) | — (output) | absent when the request is not authenticated |

## 3. Validation rules

- **V1** — A protected request must carry an authentication token; a request
  with no token (or no token in the expected form) is invalid.
- **V2** — The token must be authentic: issued by this system and unaltered. A
  token that fails authenticity is invalid.
- **V3** — The token must not be expired: its validity period must not have
  passed.
- **V4** — The token must identify a user (carry a user id); an otherwise-valid
  token that identifies no user is invalid.

## 4. Error responses

- **E1 — Missing authentication.** Trigger: V1 fails (no token supplied). The
  caller is told the request is not authenticated because no token was
  provided. Distinguished from E2/E3 as the "no credentials" case.
- **E2 — Expired token.** Trigger: V3 fails (token expired). The caller is told
  the token has expired. Distinguished from E3 so a client can tell it should
  obtain a new token rather than that the token was never valid.
- **E3 — Invalid token.** Trigger: V2 or V4 fails (token not authentic,
  unreadable, or identifying no user). The caller is told the token is invalid.

All three reject the request, run no protected action, and make no identity
available. All three represent the same broad outcome ("not authenticated") but
carry distinct wording per the distinctions above.

## 5. Acceptance criteria

- **AC1** — Given a protected action and a valid, unexpired token identifying
  user U, When the request is made with that token, Then the action proceeds and
  the caller identity carrying user id U is available to it.
- **AC2** — Given a protected action, When the request is made with no
  authentication token, Then the request is rejected as not authenticated
  (missing token) and the action does not run.
- **AC3** — Given a protected action, When the request is made with an expired
  token, Then the request is rejected, the caller is told the token has expired,
  and the action does not run.
- **AC4** — Given a protected action, When the request is made with a token that
  is not authentic or is unreadable, Then the request is rejected as invalid and
  the action does not run.
- **AC5** — Given a protected action, When the request is made with an
  otherwise-valid token that identifies no user, Then the request is rejected as
  invalid and the action does not run.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should token validation be handled by a dedicated validation step that returns the identity to attach? | Yes — a dedicated token-validation step validates and returns the identity | Behavior §1 and field "caller identity" (§2) describe a validate-then-attach flow |
| 2 | What identity should be made available once authenticated? | Only the caller's user id, for now | Field "caller identity" holds just a user id (§2) |
| 3 | Should the guard be applied to existing actions as part of this feature? | No — deliver the reusable guard only | Scope note in §1; no AC exercises a pre-existing action |
| 4 | What is the shape of the attached identity? | An object mirroring the validation step's result (currently just the user id) | Field "caller identity" is an object holding the user id (§2) |
| 5 | Should an expired token be reported distinctly from an otherwise-invalid token? | Yes — expired is reported distinctly | E2 (expired) is separate from E3 (invalid); AC3 separate from AC4 |
