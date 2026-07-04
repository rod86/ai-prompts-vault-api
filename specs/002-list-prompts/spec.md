# Spec: List prompts
Status: READY FOR REVIEW
Story: As a user, I want to retrieve all prompts, optionally filtered by category, so that I can find the ones I need.

## 1. Behavior

**Main flow:** The user requests the list of prompts. The system returns
every prompt currently available, each shown with the category it belongs
to (identified by the category's id and name), its title, its prompt text,
its optional description, and when it was created and last updated. Prompts
are ordered from most recently created to least recently created.

**Alternate flow — filter by category:** The user requests the list of
prompts while specifying a category value. The system returns only the
prompts that belong to that exact category, in the same most-recent-first
order. Supplying a category value is optional; when omitted, the main flow
applies and every prompt is returned regardless of category.

**Alternate flow — filter matches nothing:** If the supplied category value
does not match any prompt currently in the system — whether because no such
category exists, or the category exists but currently has no prompts — the
user receives an empty list. This is a normal, successful outcome, not an
error: a filter that finds nothing is not a mistake.

**Alternate flow — no prompts at all:** If no prompts currently exist (with
or without a category filter), the user receives an empty list. This is
also a normal, successful outcome, not an error.

**Alternate flow — prompt without a description:** A prompt may have no
description. When shown to the user, such a prompt is included in the list
like any other, simply without a description value — its absence is not an
error and does not exclude the prompt from the list.

## 2. Fields

| Field | Meaning | Domain type | Required | Default |
|---|---|---|---|---|
| id | Unique identifier of the prompt | text | true | — |
| category.id | Unique identifier of the category the prompt belongs to | text | true | — |
| category.name | Human-readable name of the category the prompt belongs to | text | true | — |
| title | Short label for the prompt | text | true | — |
| prompt | The prompt's text content | text | true | — |
| description | Optional short summary of the prompt | text | false | none |
| createdAt | When the prompt was created | date | true | — |
| updatedAt | When the prompt was last updated | date | true | — |

`category.id` and `category.name` together describe one category reference
per prompt (see Behavior above); they are not independent, unrelated
fields.

## 3. Validation rules

This operation is read-only. Its only user-supplied input is an optional
category filter value. That value is treated as an opaque piece of text
compared for an exact match: any value is accepted, including one that
matches no category or no prompt (see the "filter matches nothing"
alternate flow in §1, and AC5). No constraint makes a category filter value
itself "invalid" — a non-matching value simply yields no results, not a
rejected request. No other validation rules apply to this listing
operation.

## 4. Error responses

This operation has no user-triggerable error conditions: requesting the
list of prompts, with or without a category filter, always succeeds,
returning the matching prompts or an empty list (see AC3, AC5). No error
responses are defined for this operation.

## 5. Acceptance criteria

- **AC1:** Given multiple prompts exist, When the user requests the list of
  prompts, Then the response includes every prompt, each with its id,
  category (id and name), title, prompt text, description, createdAt, and
  updatedAt.
- **AC2:** Given multiple prompts exist, When the user requests the list of
  prompts (with or without a category filter), Then the prompts are
  ordered from most recently created to least recently created.
- **AC3:** Given no prompts exist, When the user requests the list of
  prompts, Then the response is an empty list, not an error.
- **AC4:** Given prompts exist in more than one category, When the user
  requests the list of prompts filtered by a category that has prompts,
  Then the response includes only the prompts belonging to that category.
- **AC5:** Given a category filter value that matches no prompt — because
  no such category exists, or it exists but currently has no prompts —
  When the user requests the list of prompts filtered by that value, Then
  the response is an empty list, not an error.
- **AC6:** Given a prompt that was created without a description, When the
  user requests the list of prompts, Then that prompt is included in the
  response with no description value, rather than an error or being left
  out of the list.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
|---|---|---|---|
| 1 | What fields does a prompt have, beyond id and the category reference? | Minimal set plus an optional description: id, category reference, title, prompt (body text), description (optional), createdAt, updatedAt. | Fixed the §2 Fields table; added AC6 to cover the optional description explicitly. |
| 2 | How is the category represented in a returned prompt? | Nested category reference — the prompt carries its category's id and name together (grouped), rather than only a bare identifier. | §2 Fields models `category.id`/`category.name` as one grouped reference; §1 Behavior describes prompts as "shown with the category it belongs to." |
| 3 | What order are prompts returned in? | Most recently created first. | Added AC2, requiring most-recent-first ordering, applying to both the filtered and unfiltered main/alternate flows. |
| 4 | How is a malformed or non-matching category filter value handled? | Treated identically to any other non-matching value: no format validation, opaque equality comparison, any non-match (whether from a nonexistent category or one with no prompts) returns an empty list, never an error. | §3 states no validation rule makes a filter value "invalid"; merged what would otherwise be two near-identical acceptance criteria into a single AC5 covering every non-matching case; §4 confirms no error responses exist for this operation. |
