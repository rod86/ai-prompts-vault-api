# Spec: Update prompt

Status: IMPLEMENTED
Story: As a user, I want to update an existing prompt so that I can correct or improve it after it was created.

## 1. Behavior

**Main flow:** The user supplies the id of an existing prompt, together with
new values for its title, its prompt text, the category it belongs to
(referenced by the category's identifier), and its description (which may be
explicitly empty of a value). The system replaces the prompt's title, prompt
text, category, and description with the newly supplied values, refreshes its
last-updated time to the moment of the update, leaves its identifier and its
original creation time unchanged, and returns the updated prompt in full: its
id, the category it belongs to (id and name), its title, its prompt text, its
description (if any), and when it was created and last updated.

**Alternate flow — description explicitly cleared:** If the user supplies no
description value (while still including the description in the request),
the prompt is updated to have no description, like a prompt that never had
one — this is a normal, successful update, not an error.

**Alternate flow — description set to a value:** If the user supplies a
description value, including one that is simply empty text, the prompt is
updated to have that value as its description. An empty piece of text is a
valid description value in its own right, distinct from supplying no value at
all.

**Alternate flow — description not supplied at all:** If the request does not
include a description at all (as opposed to including one with no value), the
user is told the description is missing. No changes are made to the prompt.

**Alternate flow — missing title:** If no title (or an empty one) is
supplied, the user is told the title is missing. No changes are made to the
prompt.

**Alternate flow — missing prompt text:** If no prompt text (or empty text)
is supplied, the user is told the prompt text is missing. No changes are made
to the prompt.

**Alternate flow — missing or malformed category reference:** If no category
reference is supplied, or the value supplied is not shaped like a valid
category identifier, the user is told the category reference is invalid. No
changes are made to the prompt.

**Alternate flow — several problems at once:** If more than one of the above
problems occurs in the same request (e.g. both the title and the description
are missing), the user is told about every problem together, not only the
first one found.

**Alternate flow — category reference does not exist:** If the supplied
category reference is validly shaped but does not correspond to any category
currently in the system, the user is told the category is invalid. No changes
are made to the prompt.

**Alternate flow — prompt not found:** If the supplied id does not correspond
to any prompt currently in the system, the user is told the prompt was not
found. No changes are made to any prompt.

**Alternate flow — prompt not found and category invalid at once:** If the
supplied id does not correspond to any existing prompt, the user is told the
prompt was not found, even if the supplied category reference is also
invalid — a prompt that does not exist cannot be updated regardless of any
other problem with the request.

## 2. Fields

| Field         | Meaning                                                                        | Domain type | Required for update                       | Default |
| ------------- | ------------------------------------------------------------------------------- | ----------- | -------------------------------------------- | ------- |
| id            | Unique identifier of the prompt to update                                       | text        | true — identifies which prompt to update     | —       |
| title         | Short label for the prompt                                                      | text        | true                                          | —       |
| prompt        | The prompt's text content                                                       | text        | true                                          | —       |
| description   | Short summary of the prompt                                                      | text        | true (the field itself), value may be absent | —       |
| category      | The category the prompt belongs to, referenced by its identifier                | text        | true                                          | —       |
| category.id   | Unique identifier of the category the prompt belongs to, in the returned prompt  | text        | false — echoes the supplied category         | —       |
| category.name | Human-readable name of the category, looked up from the supplied category       | text        | false — derived, not supplied directly       | —       |
| createdAt     | When the prompt was originally created                                          | date        | false — unchanged by this operation          | —       |
| updatedAt     | When the prompt was last updated                                                 | date        | false — assigned by the system               | current date/time at update |

`category.id` and `category.name` together describe one category reference in
the returned prompt (see `003-get-prompt` §2); they are not independent,
unrelated fields. Unlike prompt creation (`005-create-prompt` §2), this
operation always requires the `description` field to be present in the
request — its value, not its presence, is what may be absent.

## 3. Validation rules

- **V1:** `title` is required and must be non-empty text. Invalid when
  missing or blank.
- **V2:** `prompt` is required and must be non-empty text. Invalid when
  missing or blank.
- **V3:** `category` is required and must be supplied in the same identifier
  format every existing category identifier already uses. Invalid when
  missing, or when the supplied value is not shaped like a valid category
  identifier — this is a shape check only, not a check that the category
  actually exists (see E2).
- **V4:** `description` must be present in the request. Its value may be
  absent (clearing the prompt's description) or any piece of text, including
  empty text (setting the description to that value). Invalid only when the
  field is missing from the request entirely.

## 4. Error responses

- **E1 — Prompt not found:** Triggered when the supplied id does not
  correspond to any prompt currently in the system. The user is told the
  prompt was not found. Distinguished from a successful response by no
  changes being made to any prompt. Takes precedence over E2: when the
  supplied id matches no prompt, the user is told the prompt was not found
  even if the category reference is also invalid.
- **E2 — Category invalid:** Triggered when the supplied category reference
  satisfies V3's shape check but does not correspond to any category
  currently in the system. The user is told the category is invalid.
  Distinguished from V3 (malformed reference) by the reference being
  correctly shaped, and from a successful response by no changes being made
  to the prompt. Only reported when the prompt itself was found (see E1).

## 5. Acceptance criteria

- **AC1:** Given an existing prompt, a title, prompt text, an existing
  category, and a description are supplied, When the user updates the
  prompt, Then the prompt's title, prompt text, category, and description
  are replaced with the supplied values, its id and creation time remain
  unchanged, its last-updated time is refreshed, and the response includes
  the updated id, category (id and name), title, prompt text, description,
  createdAt, and updatedAt.
- **AC2:** Given the description is supplied with no value, When the user
  updates the prompt, Then the prompt is updated to have no description,
  rather than an error.
- **AC3:** Given the description is supplied as empty text, When the user
  updates the prompt, Then the prompt is updated to have that empty text as
  its description, distinct from having no description at all.
- **AC4:** Given the description field is missing from the request entirely,
  When the user attempts to update the prompt, Then the user is told the
  description is missing (V4), and no changes are made to the prompt.
- **AC5:** Given the title is missing or blank, When the user attempts to
  update the prompt, Then the user is told the title is missing (V1), and no
  changes are made to the prompt.
- **AC6:** Given the prompt text is missing or blank, When the user attempts
  to update the prompt, Then the user is told the prompt text is missing
  (V2), and no changes are made to the prompt.
- **AC7:** Given the category reference is missing or not shaped like a
  valid category identifier, When the user attempts to update the prompt,
  Then the user is told the category reference is invalid (V3), and no
  changes are made to the prompt.
- **AC8:** Given more than one of title, prompt text, category reference, and
  description are missing or invalid at once, When the user attempts to
  update the prompt, Then the user is told about every one of those problems
  together (V1/V2/V3/V4), not only the first one found, and no changes are
  made to the prompt.
- **AC9:** Given the category reference is validly shaped but does not
  correspond to any existing category, When the user attempts to update the
  prompt, Then the user is told the category is invalid (E2), and no changes
  are made to the prompt.
- **AC10:** Given no prompt exists with the supplied id, When the user
  attempts to update a prompt, Then the user is told the prompt was not
  found (E1), and no changes are made to any prompt.
- **AC11:** Given no prompt exists with the supplied id, and the supplied
  category reference is also invalid, When the user attempts to update the
  prompt, Then the user is told only that the prompt was not found (E1), not
  that the category is invalid.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | Is `description` required in the update request, and can its value be absent? | `description` must always be present as a field in the request, but its value may be absent to explicitly clear the stored description — neither fully optional (can be omitted) nor required-non-absent (must always carry a value). | Added V4 (field required, value may be absent); this also settles the operation's overall shape as a full replacement of every field (title, prompt, category, and description) on every update, not a partial patch of only the fields supplied — added AC1/AC2/AC4. |
| 2 | (judgment call per explicit instruction, not re-interviewed) How is an explicitly-empty description value treated, given its value may otherwise be absent? | Treated as a valid, ordinary description value in its own right — mirroring `005-create-prompt`'s decision not to constrain description content beyond its optionality — and explicitly distinct from supplying no value at all (which clears the description instead). | Added AC3, and V4's wording distinguishing "field missing" (invalid) from "value absent" and "value is any text, including empty" (both valid). |
| 3 | (judgment call, consistent with `003-get-prompt`'s and `005-create-prompt`'s precedents) When the prompt id does not match any existing prompt and the category reference is also invalid, which problem is the user told about? | The user is told only that the prompt was not found — a prompt that does not exist cannot be updated, regardless of any other problem with the request; this mirrors treating "the resource being addressed doesn't exist" as taking priority over business-rule checks on the request body. | Added E1's precedence note over E2, and AC11. |
