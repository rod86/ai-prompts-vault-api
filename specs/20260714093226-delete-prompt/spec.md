# Spec: Delete a prompt
Status: READY TO IMPLEMENT
Story: As a user, I want to delete a prompt by its identifier so that prompts I no longer need stop appearing in my vault.

## 1. Behavior
Main flow:
1. A user asks to delete a specific prompt, identified by its unique identifier.
2. When a prompt with that identifier exists, it is permanently removed from the vault and the user is told the deletion succeeded, with no content returned.

Alternate flows:
- If no prompt matches the given identifier, the user is told the prompt was not found and nothing is removed.
- If the given identifier is malformed, the user is told the identifier is invalid and nothing is removed.

## 2. Fields
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier of the prompt to delete | text (unique identifier) | Yes | — |

## 3. Validation rules
- **V1** — `id` must be a well-formed unique identifier. An identifier that does not match the expected identifier format is invalid.

## 4. Error responses
- **E1** — Prompt not found: the given identifier is well-formed but matches no existing prompt. The user is told the prompt was not found, naming the identifier. Distinguished from E2 by the identifier being valid in shape but absent.
- **E2** — Invalid identifier: the given identifier is malformed (fails V1). The user is told the identifier is invalid. Distinguished from E1 by the failure being about the shape of the identifier, not its existence.

## 5. Acceptance criteria
- **AC1** — Given a prompt exists with a known identifier, When the user deletes it by that identifier, Then the prompt is removed from the vault and a success-with-no-content result is returned.
- **AC2** — Given no prompt exists with a given well-formed identifier, When the user deletes by that identifier, Then a prompt-not-found error (E1) is returned and nothing is removed.
- **AC3** — Given a malformed identifier, When the user deletes by that identifier, Then an invalid-identifier error (E2) is returned and nothing is removed.

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | What should a successful deletion return? | Success with no content | AC1 returns success without a body; §1 main flow reflects "no content returned" |
