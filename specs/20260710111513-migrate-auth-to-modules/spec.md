# Spec: Rebuild the sign-in (authentication) capability in the current module structure
Status: IMPLEMENTED
Story: As a developer, I want the sign-in capability rebuilt inside the project's current module structure, coexisting with its existing implementation, so that a verified, current-standards foundation exists for retiring the existing implementation later.

## 1. Behavior

The sign-in capability — exchanging an email and password for an access token — is
already fully specified by `009-login`. This work does not change what that capability
does or how it behaves for a caller; it rebuilds its internal implementation to follow the
project's current architecture guidelines, and does not yet replace the implementation the
running application actually uses.

**Main flow:** Sign-in is rebuilt so that it produces the exact same result, in the exact
same situations, as it already does today — a matching email and password yield an access
token that carries the account's identifier and an expiry a fixed number of seconds ahead
of the current moment, and every failure situation behaves exactly as before. The rebuilt
version is not yet reachable by a caller; the existing implementation keeps handling every
sign-in request exactly as before.

**Alternate flow — password verification uses the shared secured-password provider
directly:** Today, sign-in checks the supplied password through a combined
authentication-crypto collaborator that both issues tokens and (by delegation) verifies
passwords. In the rebuilt version, password verification is performed through the project's
shared secured-password provider directly, and token issuance is a separate, single-purpose
collaborator. This is purely internal: the same password is compared against the same
stored secured form, producing the same accept/reject outcome as before — there is no
observable difference to a caller, and since the rebuilt version isn't reachable yet, there
is nothing to observe from outside at all in this iteration.

**Coexistence flow (interim):** The existing implementation of this capability remains
present and unchanged, and keeps handling every sign-in request exactly as it does today.
The rebuilt version exists alongside it. Duplication is accepted for this period, the same
way it already was when the project's shared cross-cutting capabilities, its prompt
management capability, and its user registration capability were rebuilt ahead of this work.

**Shared account records:** The stored account records are read by more than one capability
— registration creates them, and sign-in reads them to authenticate. This work rebuilds
only the sign-in capability's read of those records; the stored account records themselves,
and every other capability that reads or writes them, remain unchanged.

**Out of scope (deferred to a future spec):**
- Making the rebuilt version the one that actually handles sign-in requests (retiring the
  existing implementation's wiring to the request edge).
- Removing the existing implementation.
- Any change to the token contents, expiry rule, error outcomes, or the fields returned to
  a caller, beyond what `009-login` already defines.
- Rebuilding or otherwise migrating any other capability that reads the same account
  records.

## 2. Fields

None new. This work rebuilds the internal implementation of the data already defined by
`009-login` — the sign-in inputs, the token result, and the projection of an account read
for authentication. Their meanings and domain types are unchanged.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| email | Email address supplied at sign-in (matched case-insensitively) | text | Yes | — |
| password | Secret supplied at sign-in; compared against the stored secured form | text | Yes | — |
| token | Access token returned on success; carries the account identifier and an expiry | text | Yes | produced by the capability at sign-in |
| id (credentials) | Identifier of the account being authenticated | text (unique id) | Yes | read from the stored record |
| email (credentials) | Email of the account being authenticated | text | Yes | read from the stored record |
| passwordHash (credentials) | Stored secured form of the account's password | text | Yes | read from the stored record |

## 3. Validation rules

- **V1** — Sign-in is reachable from the rebuilt implementation and, for the same inputs and
  the same underlying data, produces the same token result and the same errors as the
  existing implementation described in `009-login`.
- **V2** — A sign-in attempt whose email matches no stored account (compared
  case-insensitively) is rejected as invalid credentials, and no token is issued — exactly
  as `009-login` describes.
- **V3** — A sign-in attempt whose email matches a stored account but whose password does
  not match the account's stored secured form is rejected as invalid credentials, and no
  token is issued — exactly as `009-login` describes.
- **V4** — On success, the issued token carries the authenticated account's identifier and
  an expiry that is the fixed configured number of seconds ahead of the current moment,
  exactly as `009-login` describes.
- **V5** — Password verification is performed through the project's shared secured-password
  provider directly, and token issuance is performed through a separate, single-purpose
  collaborator — the two responsibilities are not bundled into one collaborator.
- **V6** — Contracts (the abstract descriptions of the capability and its collaborators) are
  kept separate from their concrete implementations, per the current architecture
  guidelines.
- **V7** — The existing implementation, the other business areas, and the stored account
  records remain unchanged; every other capability that reads or writes the account records
  continues to do so exactly as before.
- **V8** — The project's automated quality gates (lint including architecture-boundary
  checks, type checking, and the full test suite) pass after the rebuild, and no change to
  stored data is required.

## 4. Error responses

- **E1** — *Invalid credentials.* When sign-in targets an email with no matching account, or
  a matching account whose password does not match its stored secured form, the caller is
  told the credentials are invalid and no token is issued. The two underlying causes are not
  distinguished from each other, exactly as `009-login` describes.

## 5. Acceptance criteria

- **AC1** — *Sign in with valid credentials.* Given the rebuilt implementation, When sign-in
  is attempted with an email that matches a stored account and the account's correct
  password, Then a token is issued carrying the account's identifier and an expiry the fixed
  configured number of seconds ahead of the current moment — exactly as `009-login`
  describes. (covers V1, V4, V5)
- **AC2** — *Unknown email rejected.* Given the rebuilt implementation, When sign-in is
  attempted with an email that matches no stored account (compared case-insensitively), Then
  the invalid-credentials error (E1) is raised, the password is never checked, and no token
  is issued — exactly as `009-login` describes. (covers V2, E1)
- **AC3** — *Wrong password rejected.* Given the rebuilt implementation, When sign-in is
  attempted with an email that matches a stored account but an incorrect password, Then the
  invalid-credentials error (E1) is raised and no token is issued — exactly as `009-login`
  describes. (covers V3, E1)
- **AC4** — *Token issued by a single-purpose issuer.* Given the rebuilt token issuer, When a
  token is issued for an account identifier and an explicit expiry, Then the token carries
  that identifier and that expiry, exactly as the existing implementation does. (covers V4,
  V5)
- **AC5** — *Credentials read from the account records.* Given the rebuilt persistence
  adapter, When an account is looked up by email, Then the same account's credentials
  projection (identifier, email, stored secured password) is found case-insensitively and
  nothing is found for an absent email, exactly as the existing adapter does. (covers V1,
  V2)
- **AC6** — *Single composition entry point.* Given the rebuilt module, When its composition
  entry point is loaded, Then it exposes a ready-to-use sign-in capability wired to the
  credentials adapter, the shared secured-password provider, the token issuer, the shared
  current-time provider, and the configured token expiry. (covers V1, V5)
- **AC7** — *Contracts separated.* Given the rebuilt module, When its structure is inspected,
  Then the capability's and its collaborators' contracts are placed separately from their
  concrete implementations, per the current architecture guidelines. (covers V6)
- **AC8** — *Legacy and shared records intact.* Given the rebuild is complete, When the
  existing implementation, the other business areas, and the stored account records are
  inspected, Then they are unchanged, every other capability that reads or writes those
  records still does so, and their existing tests still pass. (covers V7)
- **AC9** — *Quality gates pass, no data change.* Given the rebuild is complete, When the
  project's lint, type-check, and full test suite are run, Then all pass and no change to
  stored data is required. (covers V8)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | How far should this auth-context migration go — rebuild-coexist (matching the shared/prompt/user precedent) or a full cutover in this same spec? | Rebuild coexisting: build the new module, leave the legacy auth context, the request edge, config, and existing wiring untouched and still handling requests; defer retirement/rewiring to a later spec. | §1 Main/Coexistence flow and "Out of scope"; V7/AC8 require the legacy implementation, business areas, and stored records to be untouched (matches how shared, prompt, and user were rebuilt). |
| 2 | The legacy sign-in depends on a combined authentication-crypto collaborator (issue token + verify password, the latter delegating to the shared secured-password provider). How should the rebuilt module handle this? | Split it: the capability verifies the password through the shared secured-password provider directly (as user registration already does), and token issuance becomes a separate, single-purpose collaborator. | §1 "Alternate flow"; V5/AC1/AC4/AC6 require password verification via the shared provider and token issuance via a separate single-purpose collaborator. |
| 3 | The rebuilt credentials read of the shared account records needs its own description of that record set (boundary rules stop it reusing another context's). Full copy matching the account records, or a minimal copy of only the read columns? | Full copy: the auth context describes the same account record set as the user context's copy (all columns plus the case-insensitive unique-email rule) and reads only the credentials columns from it; it is not registered into the aggregated record set, so no data change results. | §2 credentials fields; V1/V2/AC5; and §4/§7 of plan.md (schema copy not aggregated, no migration). |
