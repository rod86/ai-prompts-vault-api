# Spec: Login
Status: READY TO IMPLEMENT
Story: As a visitor, I want to login with an email and password so that I receive a token proving my identity for subsequent requests.

## 1. Behavior

**Main flow:** The visitor supplies an email address and a password. The
system looks up the account whose email matches the one supplied — comparing
the email without regard to letter case, consistent with how an account's
email is already guaranteed unique regardless of case — and checks the
supplied password against that account's stored credential. When the account
exists and the password matches, the visitor is issued a token that proves
their identity for later requests. No other account information is returned.

**Alternate flow — missing email:** If no email is supplied, the visitor is
told the email is missing. No token is issued.

**Alternate flow — missing password:** If no password is supplied, the
visitor is told the password is missing. No token is issued.

**Alternate flow — several problems at once:** If both the email and the
password are missing from the same request, the visitor is told about both
problems together, not only the first one found.

**Alternate flow — no matching account:** If the supplied email does not
belong to any existing account, the visitor is told that the email or
password is invalid. No token is issued. This is deliberately the same
message as the next alternate flow, so a visitor cannot tell whether the
email itself is registered.

**Alternate flow — wrong password:** If the supplied email belongs to an
existing account but the supplied password does not match that account's
stored credential, the visitor is told that the email or password is
invalid — the exact same message as when the email does not belong to any
account. No token is issued.

## 2. Fields

| Field    | Meaning                                         | Domain type | Required | Default |
| -------- | ------------------------------------------------ | ----------- | -------- | ------- |
| email    | The email address of the account logging in       | text        | true     | —       |
| password | The password to check against the account         | text        | true     | —       |
| token    | Proof of identity returned to the visitor on success | text     | false — assigned by the system | generated on successful login |

## 3. Validation rules

- **V1:** `email` is required. Invalid when missing. No shape/format check is
  performed at this stage — an email that does not belong to any account
  (whatever its shape) is handled by E1, not by a validation rule, so that a
  malformed email reveals no more information than an unregistered one.
- **V2:** `password` is required. Invalid when missing.

## 4. Error responses

- **E1 — Invalid email or password:** Triggered either when the supplied
  email does not belong to any existing account, or when it does but the
  supplied password does not match that account's stored credential. In both
  cases the visitor is told, identically, that the email or password is
  invalid — never which of the two was wrong, and never that a name/account
  exists at all. Distinguished from V1/V2 (a field being missing) by both
  fields being present but not matching a valid, existing credential pair.

## 5. Acceptance criteria

- **AC1:** Given an email that belongs to an existing account and the
  matching password for that account are supplied, When the visitor logs in,
  Then a token proving their identity is issued, and no other account
  information is returned.
- **AC2:** Given an email that belongs to an existing account with uppercase
  letters compared to how the account was registered (e.g. the account's
  email is "ada@example.com" and the visitor supplies "Ada@Example.com")
  along with the matching password, When the visitor logs in, Then a token is
  issued exactly as in AC1 — the email match does not depend on letter case.
- **AC3:** Given the email is missing, When the visitor attempts to log in,
  Then the visitor is told the email is missing (V1), and no token is issued.
- **AC4:** Given the password is missing, When the visitor attempts to log
  in, Then the visitor is told the password is missing (V2), and no token is
  issued.
- **AC5:** Given both the email and the password are missing, When the
  visitor attempts to log in, Then the visitor is told about both problems
  together (V1/V2), not only the first one found, and no token is issued.
- **AC6:** Given the supplied email does not belong to any existing account,
  When the visitor attempts to log in, Then the visitor is told the email or
  password is invalid (E1), and no token is issued.
- **AC7:** Given the supplied email belongs to an existing account but the
  supplied password does not match that account's stored credential, When
  the visitor attempts to log in, Then the visitor is told the email or
  password is invalid (E1) — the exact same message as AC6 — and no token is
  issued.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | How should the new `auth` context read user credentials without violating the enforced hexagonal boundary? | Auth calls user's public services entrypoint, which exposes a new use case (e.g. verify-credentials) — no lint-config changes. | No spec-level change (this is purely a plan.md-level architecture decision); recorded here since it was resolved via an explicit interview question before plan.md could be authored. |
| 2 | Where should password comparison happen, and what does user expose to auth? | Compare inside the user context. Add a `compare(password, hash)` capability to the user context's existing password-hashing mechanism. User exposes a use case taking email+password, returning either the account (with no password-related data) or an invalid-credentials signal — the stored credential never crosses into auth. | No spec-level change (implementation mechanism); shapes E1's "never that a name/account exists at all" wording — the invalid-credentials signal collapses both "no such email" and "wrong password" into one outcome before it ever reaches the response. |
| 3 | Which JWT library and token config? | `jsonwebtoken`, HS256, 1 hour expiry. Secret read exclusively via the project's config loading mechanism. | No spec-level change (pure implementation mechanism; the spec's "token" field stays a domain-typed `text` value with no exposed expiry behavior, since the story does not ask the visitor to observe or react to expiry). |
| 4 | Generic vs field-specific invalid-credentials error? | Generic "invalid email or password" for both the unknown-email and the wrong-password cases (avoid account enumeration). | Added E1's "never which of the two was wrong" wording; added the explicit "identically" language to AC6/AC7 tying both alternate flows to the same message. |
| 5 | (Design correction, not a fresh interview question) The first-authored plan.md had `auth` call into `user` via a new `VerifyUserCredentialsUseCase` exposed from `user/services.ts`, and added `compare()` to `user`'s own password-hashing port/adapter so verification happened inside `user`. The user rejected this after reviewing the plan: "remove all changes related to user context. password verification should go in auth. Better duplicate interfaces and code adjusted to needs than weird imports or big classes." | `user` is reverted to exactly its `008` shape except that its password-hashing port/adapter (`PasswordHasherInterface`/`BcryptPasswordHasher`) is promoted to a `shared` module, since that one piece of logic is genuinely identical for both `user` (hashing) and `auth` (verifying) — not duplicated. Everything else `auth` needs (reading a user's credentials, issuing a token, checking a password) is owned and duplicated inside `auth` itself: a duplicated read of the `users` table (no call into `user`), and one combined port for token issuance + password verification. The token's expiration is computed from an injected Clock port plus an `.env`-sourced duration, never a hidden `new Date()` call or a hardcoded duration string. | No spec-level change — this is purely a plan.md/tasks.md-level architecture correction (which context owns which code, not what the visitor observes). Recorded here since it reverses Decision #1 and part of Decision #2 above, which were resolved via the initial interview before the first plan.md draft; those two rows are left as-is (historical record of what was asked and initially answered), and this row records the subsequent correction. |
| 6 | (Design correction, not a fresh interview question) Decision #5's plan.md had `auth` define its own second `pgTable` object (`authUsers`) duplicating `user`'s `users` table definition, to avoid importing `user`'s schema file. The user rejected this: "dont duplicate table definition. its already inferred because databaseclient typeof config.database.schema. No need to duplicate schemas when having repositories in different contexts that use same schema." | `auth` defines no schema file at all. `user`'s `users` table (`008` plan.md §7) remains the single definition. `auth`'s repository is constructed with the shared, fully-typed connection (`DatabaseConnection<typeof config.database.schema>`, from `databaseClient` in `shared/services.ts`) and reads via Drizzle's relational query API (`db.query.users.findFirst(...)`) — which resolves against the schema already aggregated at the composition root, with no table object to import or duplicate. | No spec-level change — plan.md/tasks.md §7 only. Recorded here since it reverses part of Decision #5's "duplicated read" wording above (that row's high-level intent — `auth` doesn't call `user`'s code — still stands; only the "duplicated table" mechanism was wrong). |
