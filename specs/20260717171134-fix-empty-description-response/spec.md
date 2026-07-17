# Spec: Echo empty prompt descriptions faithfully
Status: READY TO IMPLEMENT
Story: As a user managing prompts, I want an empty description I submit to be reported back exactly as I submitted it (an empty text), so that the confirmation I receive matches what is actually stored.

## 1. Behavior
When a user creates or updates a prompt, they may supply a description, supply an
empty description, or omit it entirely. These are three distinct intentions and the
system already records them distinctly:

- **Description supplied (non-empty)** — the prompt carries that text.
- **Description supplied but empty** — the prompt carries an empty description. An
  empty description is a real, deliberate value, distinct from "no description".
- **Description omitted** — the prompt carries no description (on create it has none;
  on update any previous description is cleared).

Main flow: the confirmation returned immediately after a create or update must report
the description exactly as it was recorded. Today, when a user supplies an empty
description, the prompt is stored with an empty description but the confirmation
wrongly reports "no description". This spec corrects that: an empty description is
reported as an empty text, so the confirmation agrees with what is stored (and with
what any later read of the prompt would report).

The "description supplied (non-empty)" and "description omitted" flows are already
correct and must remain unchanged.

## 2. Fields
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| description | Free-text note describing the prompt | text | No | none (absent) |

<!-- "description" has three observable states: absent (no description), empty text, and non-empty text. Empty text is distinct from absent. -->

## 3. Validation rules
- **V1** — A supplied `description` may be any text, including empty text. Empty text
  is accepted and treated as a distinct value from an absent description; it is never
  coerced into "absent" when reporting the result back to the user.

## 4. Error responses
None. This change adds no new error conditions and removes none.

## 5. Acceptance criteria
- **AC1** — Given a user creating a prompt, When they supply an empty description,
  Then the create confirmation reports the description as an empty text (not absent)
  and the stored description is an empty text. (covers V1)
- **AC2** — Given a user updating a prompt, When they supply an empty description,
  Then the update confirmation reports the description as an empty text (not absent)
  and the stored description is an empty text. (covers V1)
- **AC3** — Given a user creating a prompt, When they omit the description, Then the
  create confirmation reports the description as absent and the stored description is
  absent. (regression guard for V1's "distinct from absent")
- **AC4** — Given a user updating a prompt, When they omit the description, Then the
  update confirmation reports the description as absent and any previous description
  is cleared. (regression guard for V1's "distinct from absent")

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | An empty description is currently accepted and stored as empty text, but the confirmation reports it as absent. Which semantics do you want? | Empty is meaningful — report the empty description faithfully rather than collapsing it to "absent". | Behavior §1 and V1 treat empty text as a distinct, faithfully-echoed value; AC1/AC2 assert the empty text is reported; storage/validation are unchanged. |
