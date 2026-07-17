# Spec: Strengthen password validation on registration
Status: IMPLEMENTED
Story: As a person registering an account, I want my password required to be both well-formed and hard to guess, so that my account is protected from weak-password compromise.

## 1. Behavior

When someone registers an account they supply a password. Today the only rule is a
minimum length. This feature adds two independent gates the password must pass, in order:

1. **Composition** — the password must be the right length and made of the right mix of
   characters (see §3, V1–V7). If it fails, registration is refused and the person is
   told, per offending rule, what is wrong with the password's shape.
2. **Strength** — a password that is well-formed but still easy to guess (for example a
   common password or a keyboard run such as `Qwerty123!`) is refused as too weak. The
   person is told the password is too weak, without per-character guidance.

Only when the password passes both gates does registration proceed as it does today
(uniqueness of the email is then checked, and on success the account is created). The
strength gate is evaluated **before** the email-uniqueness check, so a weak password is
rejected as weak even when the email is also already in use, and no account lookup or
account creation happens for a weak password.

Nothing else about registration changes. No other flow accepts a password today, so no
other flow is affected.

## 2. Fields

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| password | The secret the person will use to authenticate | text | Yes | — |

<!-- name and email are unchanged by this feature; only password's rules change. -->

## 3. Validation rules

Rules V1–V7 govern the password's **composition** and are reported per rule (E1). Rule V8
governs its **strength** (E2). The allowed special characters referenced below are exactly
this set (space and any other character are not allowed):

```
! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ ` { | } ~
```

| # | Field | Constraint | "Invalid" means |
| - | ----- | ---------- | --------------- |
| V1 | password | At least 8 characters long | Fewer than 8 characters |
| V2 | password | At most 64 characters long | More than 64 characters |
| V3 | password | Contains at least one lowercase letter (a–z) | No lowercase letter present |
| V4 | password | Contains at least one uppercase letter (A–Z) | No uppercase letter present |
| V5 | password | Contains at least one digit (0–9) | No digit present |
| V6 | password | Contains at least one allowed special character | No allowed special character present |
| V7 | password | Contains **only** letters, digits, and allowed special characters | Contains a space, accented/other letter, or any character outside the allowed set |
| V8 | password | Is not easily guessable — meets a minimum strength standard | Judged easy to guess (e.g. a common password or keyboard run), even if V1–V7 pass |

<!-- V1–V7 are order-sensitive at report time: exactly one composition reason is reported
per submission, the first unmet rule in the order V1→V7. -->

## 4. Error responses

| # | Trigger | What the person is told | Distinguished by |
| - | ------- | ----------------------- | ---------------- |
| E1 | Password fails any of V1–V7 | A request-validation refusal naming the `password` field with the reason for the first unmet composition rule | It is a request-validation refusal carrying field-level detail on `password` |
| E2 | Password passes V1–V7 but fails V8 | The password is too weak | A distinct "too weak" refusal with **no** field-level detail; a different refusal than the already-in-use email refusal |

## 5. Acceptance criteria

- **AC1** — Given a password that satisfies V1–V8 and a not-yet-used email, When the person
  registers, Then the account is created and returned as it is today.
- **AC2** — Given a password shorter than 8 characters, When the person registers, Then
  registration is refused with the "at least 8 characters" reason on `password` (E1, V1).
- **AC3** — Given a password longer than 64 characters that otherwise satisfies V3–V7,
  When the person registers, Then registration is refused with the "at most 64 characters"
  reason on `password` (E1, V2).
- **AC4** — Given a password with no lowercase letter that otherwise satisfies V1–V2 and
  V4–V7, When the person registers, Then registration is refused with the "lowercase
  letter" reason on `password` (E1, V3).
- **AC5** — Given a password with no uppercase letter that otherwise satisfies V1–V3 and
  V5–V7, When the person registers, Then registration is refused with the "uppercase
  letter" reason on `password` (E1, V4).
- **AC6** — Given a password with no digit that otherwise satisfies V1–V4 and V6–V7, When
  the person registers, Then registration is refused with the "digit" reason on `password`
  (E1, V5).
- **AC7** — Given a password with no allowed special character that otherwise satisfies
  V1–V5 and V7, When the person registers, Then registration is refused with the "special
  character" reason on `password` (E1, V6).
- **AC8** — Given a password containing a disallowed character (a space or an accented
  letter) that otherwise satisfies V1–V6, When the person registers, Then registration is
  refused with the "disallowed character" reason on `password` (E1, V7).
- **AC9** — Given a well-formed but easily guessed password (satisfies V1–V7) and a
  not-yet-used email, When the person registers, Then registration is refused as too weak
  (E2, V8) and no account is created.
- **AC10** — Given the strength judgement, When a password is measured, Then a password at
  or above the minimum strength standard is judged strong and one below it is judged weak,
  across the full range of strength levels.
- **AC11** — Given a weak password and an email that is already in use, When the person
  registers, Then registration is refused as too weak (E2), the too-weak refusal takes
  precedence over the already-in-use refusal, and no email lookup or account creation
  occurs.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Does the one-line story capture the feature? | Approve as written | Fixed the Story line; scope = registration only, both composition and strength gates |
| 2 | Which characters count as "special", and what about spaces/accents? | Exactly the named set; space and any other character disallowed | V6 (must contain one) + V7 (only allowed characters) |
| 3 | Minimum and maximum length? | Min 8, max 64 | V1, V2 |
| 4 | When a password breaks several composition rules, report all or one? | Report one — the first unmet rule | E1 reports a single composition reason; ACs isolate one rule each |
| 5 | Should strength be checked, and how strict? | Yes; reject anything below a "safely unguessable" standard (scores 3 and 4 of 0–4 pass, below 3 fails) | V8, E2, AC10 |
| 6 | Should the strength refusal expose detailed guidance/tips? | No — a generic "too weak" message, no field detail | E2 carries no field-level detail |
| 7 | Order of the strength gate vs. the email-uniqueness check? | Strength first (fail-fast, before any account lookup or creation) | Behavior §1, AC11 |
| 8 | Which flows are in scope? | Registration only (the sole flow accepting a password today) | Behavior §1 scope note |
