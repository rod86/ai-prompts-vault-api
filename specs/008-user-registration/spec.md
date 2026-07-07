# Spec: User registration

Status: READY TO IMPLEMENT
Story: As a visitor, I want to create an account so that I can save and manage my own prompts.

## 1. Behavior

**Main flow:** The visitor supplies a name, an email address, and a password.
The system creates a new account from this input, assigns it a unique
identifier and a creation time (its last-updated time is the same as its
creation time at this point), and returns the newly created account: its id,
name, email, when it was created, and when it was last updated. The password
is never included in this or any other response.

**Alternate flow — missing name:** If no name (or an empty one) is supplied,
the visitor is told the name is missing. No account is created.

**Alternate flow — missing email:** If no email is supplied, the visitor is
told the email is missing. No account is created.

**Alternate flow — malformed email:** If an email is supplied but it is not
shaped like a valid email address, the visitor is told the email is invalid.
No account is created.

**Alternate flow — missing password:** If no password is supplied, the
visitor is told the password is missing. No account is created.

**Alternate flow — password too weak:** If a password is supplied but it does
not meet the account password requirement, the visitor is told what that
requirement is. No account is created.

**Alternate flow — several problems at once:** If more than one of the above
problems occurs in the same request (e.g. both the name and the password are
missing), the visitor is told about every problem together, not only the
first one found.

**Alternate flow — email already in use:** If the supplied email already
belongs to an existing account — comparing the email without regard to
letter case, so "Ada@Example.com" and "ada@example.com" are treated as the
same email — the visitor is told the email is already in use. No new account
is created.

**Alternate flow — mixed-case email, no existing match:** An email may
contain uppercase letters. As long as it does not match an existing account
when compared without regard to letter case, the account is created normally,
and the email is returned exactly as it was supplied (its letter case is not
changed).

## 2. Fields

| Field     | Meaning                                                        | Domain type | Required at creation                       | Default                       |
| --------- | --------------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------ |
| name      | The account holder's display name                              | text        | true                                         | —                               |
| email     | The account holder's email address, used to identify the account | text      | true                                         | —                               |
| password  | The account holder's chosen credential                          | text        | true                                         | — (never returned in any response) |
| id        | Unique identifier assigned to the new account                  | text        | false — assigned by the system              | generated at creation           |
| createdAt | When the account was created                                    | date        | false — assigned by the system              | current date/time at creation   |
| updatedAt | When the account was last updated                                | date        | false — assigned by the system              | same as createdAt at creation   |

## 3. Validation rules

- **V1:** `name` is required and must be non-empty text. Invalid when missing
  or blank.
- **V2:** `email` is required and must be shaped like a valid email address.
  Invalid when missing, or when the supplied value is not a validly formatted
  email address — this is a shape check only, not a check that the email is
  free to use (see E1).
- **V3:** `password` is required and must meet the account password
  requirement: at least 8 characters long, and containing at least one
  uppercase letter, one lowercase letter, one digit, and one special
  (non-alphanumeric) character. Invalid when missing, or when the supplied
  value does not meet this requirement.

## 4. Error responses

- **E1 — Email already in use:** Triggered when the supplied email satisfies
  V2's shape check but, compared without regard to letter case, already
  belongs to an existing account. The visitor is told the email is already in
  use. Distinguished from V2 (malformed email) by the email being correctly
  formatted, and from a successful response by no account being created and
  no account data being returned.

## 5. Acceptance criteria

- **AC1:** Given a name, an email not already used by any existing account,
  and a password meeting the password requirement are supplied, When the
  visitor creates an account, Then a new account is created and the response
  includes its id, name, email, createdAt, and updatedAt, and never includes
  the password.
- **AC2:** Given the name is missing or blank, When the visitor attempts to
  create an account, Then the visitor is told the name is missing (V1), and
  no account is created.
- **AC3:** Given the email is missing, When the visitor attempts to create an
  account, Then the visitor is told the email is missing (V2), and no account
  is created.
- **AC4:** Given the email is supplied but is not shaped like a valid email
  address, When the visitor attempts to create an account, Then the visitor
  is told the email is invalid (V2), and no account is created.
- **AC5:** Given the password is missing, When the visitor attempts to create
  an account, Then the visitor is told the password is missing (V3), and no
  account is created.
- **AC6:** Given the password is supplied but does not meet the password
  requirement (e.g. it is too short, or lacks an uppercase letter, a
  lowercase letter, a digit, or a special character), When the visitor
  attempts to create an account, Then the visitor is told the password
  requirement that must be met (V3), and no account is created.
- **AC7:** Given more than one of name, email, and password are missing or
  invalid at once, When the visitor attempts to create an account, Then the
  visitor is told about every one of those problems together (V1/V2/V3), not
  only the first one found, and no account is created.
- **AC8:** Given the supplied email already belongs to an existing account,
  comparing without regard to letter case, When the visitor attempts to
  create an account, Then the visitor is told the email is already in use
  (E1), and no new account is created.
- **AC9:** Given an email containing uppercase letters is supplied and does
  not match any existing account when compared without regard to letter case,
  When the visitor creates an account, Then the account is created and the
  response's email is exactly what was supplied, not changed in letter case.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | What is the exact password strength policy? | Minimum 8 characters, must include at least one uppercase letter, one lowercase letter, one digit, and one special character. | Added V3, AC6; alternate flow "password too weak" describes the requirement in domain language. |
| 2 | How is "email already in use" distinguished from other errors (and what precedent does it set)? | It is a distinct problem (E1) from a malformed email (V2): a correctly-shaped email that collides with an existing account. (The concrete status-code precedent this establishes is a plan.md-level decision, out of scope for this file per the "no tech" rule.) | Added E1, AC8, distinguishing it explicitly from V2. |
| 3 | Should email matching for "already in use" be case-sensitive or case-insensitive, and what casing is returned to the visitor? | Case-insensitive for matching/uniqueness ("Ada@Example.com" and "ada@example.com" are the same account), but the email is stored and returned exactly as the visitor typed it — never normalized in the response. | Added the "email already in use" and "mixed-case email, no existing match" alternate flows; added AC8, AC9. |
| 4 | What is the exact password hashing algorithm/library used to protect the stored credential (spec §1's "the password is never included in this or any other response" implies it is never stored or returned in plain text either)? | bcrypt, e.g. 10 salt rounds. | No spec-level change (this is purely a plan.md-level implementation mechanism — the spec's "password is never included in any response" behavior and V3's strength rule are unaffected); recorded here since it was resolved via an explicit interview question before plan.md could be authored. |
