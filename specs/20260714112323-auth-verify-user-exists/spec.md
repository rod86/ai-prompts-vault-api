# Spec: Authentication guard rejects tokens for nonexistent users
Status: READY TO IMPLEMENT
Story: As an API consumer, I want the authentication guard to confirm that the user id carried by my token still corresponds to an existing user account so that a token whose user has been deleted (or never existed) is rejected as invalid rather than treated as authenticated.

_Relationship to prior work: this spec extends the guard delivered by_
_`specs/20260714105845-auth-token-middleware/spec.md` (Status: IMPLEMENTED, and_
_therefore immutable — this is a new, additive spec rather than an edit to that_
_folder). That spec's plan explicitly assumed no database lookup of the token's_
_user id ("a token for a since-deleted user would still authenticate" — see its_
_`plan.md` §7, Assumption 2). This spec reverses that assumption. All fields,_
_and the "invalid token" rejection wording, are reused unchanged from that spec;_
_only one new validation rule and its acceptance criterion are added here._

## 1. Behavior

**Main flow (extends the existing guard).** After the guard confirms the token
is authentic, unexpired, and identifies a user id (as in the prior spec), it
additionally looks up that user id and confirms a matching user account exists
before letting the protected action proceed with the caller identity.

**Alternate flow — Nonexistent user.** The token is authentic, unexpired, and
well-formed (it identifies a user id), but no user account matches that user
id — for example, the account was deleted after the token was issued. The
action is not performed; the caller is told the token is invalid, using the
same wording/category as any other invalid token. This case is not
distinguished from a structurally-invalid one (see Decision 1).

## 2. Fields

No new or changed fields. This spec reuses "authentication token" and "caller
identity" exactly as defined in
`specs/20260714105845-auth-token-middleware/spec.md` §2.

## 3. Validation rules

- **V1** — The user id carried by an otherwise-valid token must correspond to
  an existing user account. A token whose user id matches no existing account
  is invalid, even if it is authentic, unexpired, and otherwise well-formed.

## 4. Error responses

- **E1 — Invalid token (reused).** Trigger: V1 fails (user id matches no
  existing account). This is an additional trigger folded into the existing
  "invalid token" rejection defined in
  `specs/20260714105845-auth-token-middleware/spec.md` §4 (its E3), alongside
  that rejection's existing triggers (token not authentic, unreadable, or
  identifying no user). The caller is told the token is invalid; no new
  wording or error category is introduced.

## 5. Acceptance criteria

- **AC1** — Given a protected action, When the request is made with a token
  that is authentic, unexpired, and identifies a user id, but that user id
  matches no existing user account, Then the request is rejected as invalid
  and the action does not run.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | When a token is well-formed and unexpired but its user id doesn't match any existing user (e.g. the account was deleted), how should the caller be told — reuse the existing `InvalidTokenError`/401 bucket, or introduce a new distinct error (mirroring how expired was split from invalid)? | Reuse `InvalidTokenError`, same 401 bucket as other invalid tokens | §1 and §4: no new error type; the nonexistent-user case folds into the existing "invalid token" trigger list rather than becoming a distinguishable rejection reason |
| 2 | How should the use case look up the user id in the database — extend the auth module's existing credentials repository, or introduce a new dedicated port? | Extend the existing `UserCredentialsRepositoryInterface` / `DrizzleUserCredentialsRepository` with a `findById` method, reusing the auth module's local `users` table copy | Carried into `plan.md`: no new port/adapter file; `ValidateTokenUseCase` gains a second constructor dependency (the same repository instance already used by `LoginUseCase`) |
