# Spec: Delete prompt

Status: IMPLEMENTED
Story: As a user, I want to delete a prompt so that it no longer shows up anywhere.

## 1. Behavior

**Main flow:** The user supplies the id of an existing prompt. The system
permanently removes that prompt. Once removed, the prompt no longer appears
in the list of prompts, no longer appears filtered under its former category,
and can no longer be looked up individually. The user is told the removal
succeeded.

**Alternate flow — prompt not found:** If the supplied id does not correspond
to any prompt currently in the system, the user is told the prompt was not
found. No prompt is removed.

**Alternate flow — deleting an already-deleted prompt:** If the user repeats
the removal for an id that was already removed (or never existed), the result
is the same as any other unmatched id: the user is told the prompt was not
found.

## 2. Fields

No fields are supplied in the body of this operation, and none are returned.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier of the prompt to remove | text | true — identifies which prompt to remove | — |

## 3. Validation rules

No validation rules beyond the id being supplied as part of the request
(there is no format constraint on it — an id that is not shaped like a valid
identifier simply matches no prompt, see E1).

## 4. Error responses

- **E1 — Prompt not found:** Triggered when the supplied id does not
  correspond to any prompt currently in the system (including an id that is
  not shaped like a valid identifier, and an id that was already removed).
  The user is told the prompt was not found. Distinguished from a successful
  removal by no prompt being removed.

## 5. Acceptance criteria

- **AC1:** Given an existing prompt, When the user deletes it by its id,
  Then the prompt is permanently removed and the user is told the removal
  succeeded.
- **AC2:** Given a prompt that was just deleted, When the user looks it up
  individually afterward, Then the prompt is not found, as if it never
  existed.
- **AC3:** Given a prompt that was just deleted, When the user lists prompts
  afterward (with or without a category filter that would otherwise have
  matched it), Then the deleted prompt does not appear in the results.
- **AC4:** Given no prompt exists with the supplied id, When the user
  attempts to delete it, Then the user is told the prompt was not found
  (E1), and no prompt is removed.
- **AC5:** Given a prompt id that was already deleted (or never existed),
  When the user attempts to delete it again, Then the user is told the
  prompt was not found (E1), identical to attempting to delete any other
  unmatched id.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | What should the confirmation that a prompt was removed consist of — an id echo, a message, a full echo of the deleted prompt, or a bare success signal with no body content? | A bare success signal, with no body content at all — the operation succeeding is itself the confirmation; no data about the deleted prompt is echoed back. Chosen by explicit user decision over the id-echo/message/full-echo alternatives, despite the story's wording suggesting a data payload. | §1's main flow says only "the user is told the removal succeeded," with no field described as part of a response payload; §2 explicitly states no fields are returned. AC1 does not describe any response content beyond succeeding. |
