# Spec: Get prompt by id

Status: IMPLEMENTED
Story: As a user, I want to open a single prompt by its id so that I can read it in full or load it before editing.

## 1. Behavior

**Main flow:** The user supplies the id of a prompt. The system returns
that prompt in full: its title, its prompt text, its optional description,
the category it belongs to (identified by the category's id and name), and
when it was created and last updated.

**Alternate flow — prompt not found:** If the supplied id does not
correspond to any prompt currently in the system, the user is told the
prompt was not found. No prompt data is returned in this case.

**Alternate flow — prompt without a description:** A prompt may have no
description. When shown to the user, such a prompt is returned like any
other, simply without a description value — its absence is not an error.

## 2. Fields

| Field         | Meaning                                                   | Domain type | Required | Default |
| ------------- | ---------------------------------------------------------- | ----------- | -------- | ------- |
| id            | Unique identifier of the prompt                             | text        | true     | —       |
| category.id   | Unique identifier of the category the prompt belongs to     | text        | true     | —       |
| category.name | Human-readable name of the category the prompt belongs to   | text        | true     | —       |
| title         | Short label for the prompt                                  | text        | true     | —       |
| prompt        | The prompt's text content                                   | text        | true     | —       |
| description   | Optional short summary of the prompt                        | text        | false    | none    |
| createdAt     | When the prompt was created                                  | date        | true     | —       |
| updatedAt     | When the prompt was last updated                             | date        | true     | —       |

`category.id` and `category.name` together describe one category reference
(see Behavior above); they are not independent, unrelated fields.

## 3. Validation rules

This operation is read-only. Its only user-supplied input is the id of the
prompt to open. That value is treated as an opaque piece of text compared
for an exact match against existing prompts: no constraint makes an id
itself "invalid" — a value that matches no prompt is handled as "not
found" (see §4), never rejected as malformed input. No other validation
rules apply to this operation.

## 4. Error responses

- **E1 — Prompt not found:** Triggered when the supplied id does not
  correspond to any prompt currently in the system. The user is told the
  prompt was not found. Distinguished from a successful response by
  carrying no prompt data at all.

## 5. Acceptance criteria

- **AC1:** Given a prompt exists, When the user opens it by its id, Then
  the response includes that prompt's id, category (id and name), title,
  prompt text, description, createdAt, and updatedAt.
- **AC2:** Given a prompt exists with no description, When the user opens
  it by its id, Then the response includes that prompt with no
  description value, rather than an error.
- **AC3:** Given no prompt exists with the supplied id, When the user
  opens a prompt by that id, Then the user is told the prompt was not
  found (E1), and no prompt data is returned.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | What fields does the full prompt include when opened by id? | The same field set already established for listing prompts (`specs/002-list-prompts`): id, category reference (id + name), title, prompt text, optional description, createdAt, updatedAt — no new fields are introduced for a single-prompt view. | Fixed the §2 Fields table to mirror `002-list-prompts` §2 exactly; added AC1/AC2 to cover the full field set and the optional description. |
| 2 | How is an id that doesn't correspond to any prompt handled? | Told "not found" (a domain error), not an empty/partial success response — distinct from list operations where a non-matching filter is a valid empty result. | Added §4 E1 and AC3. |
