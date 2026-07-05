# Spec: Create prompt

Status: READY FOR REVIEW
Story: As a user, I want to add a new prompt under a category so that it becomes available for everyone.

## 1. Behavior

**Main flow:** The user supplies a title, the prompt's text content, and the
category it belongs to (referenced by the category's identifier), and may
optionally supply a short description. The system creates a new prompt from
this input, assigns it a unique identifier and a creation time (its last-updated
time is the same as its creation time at this point), and returns the newly
created prompt in full: its id, the category it belongs to (id and name), its
title, its prompt text, its description (if any), and when it was created and
last updated.

**Alternate flow — missing title:** If no title (or an empty one) is supplied,
the user is told the title is missing. No prompt is created.

**Alternate flow — missing prompt text:** If no prompt text (or empty text) is
supplied, the user is told the prompt text is missing. No prompt is created.

**Alternate flow — missing or malformed category reference:** If no category
reference is supplied, or the value supplied is not shaped like a valid
category identifier, the user is told the category reference is invalid. No
prompt is created.

**Alternate flow — several problems at once:** If more than one of the above
problems occurs in the same request (e.g. both the title and the prompt text
are missing), the user is told about every problem together, not only the
first one found.

**Alternate flow — category reference does not exist:** If the supplied
category reference is validly shaped but does not correspond to any category
currently in the system, the user is told the category is invalid. No prompt
is created.

**Alternate flow — no description supplied:** A prompt may be created without
a description. It is created and returned like any other, simply without a
description value — its absence is not an error.

## 2. Fields

| Field         | Meaning                                                                          | Domain type | Required at creation             | Default                       |
| ------------- | --------------------------------------------------------------------------------- | ----------- | ----------------------------------- | ------------------------------ |
| title         | Short label for the prompt                                                        | text        | true                                 | —                               |
| prompt        | The prompt's text content                                                         | text        | true                                 | —                               |
| description   | Optional short summary of the prompt                                              | text        | false                                | none                            |
| category      | The category the prompt belongs to, referenced by its identifier                  | text        | true                                 | —                               |
| id            | Unique identifier assigned to the new prompt                                      | text        | false — assigned by the system      | generated at creation           |
| category.id   | Unique identifier of the category the prompt belongs to, in the returned prompt    | text        | false — echoes the supplied category | —                               |
| category.name | Human-readable name of the category, looked up from the supplied category         | text        | false — derived, not supplied directly | —                             |
| createdAt     | When the prompt was created                                                       | date        | false — assigned by the system      | current date/time at creation   |
| updatedAt     | When the prompt was last updated                                                   | date        | false — assigned by the system      | same as createdAt at creation   |

`category.id` and `category.name` together describe one category reference in
the returned prompt (see `003-get-prompt` §2); they are not independent,
unrelated fields.

## 3. Validation rules

- **V1:** `title` is required and must be non-empty text. Invalid when
  missing or blank.
- **V2:** `prompt` is required and must be non-empty text. Invalid when
  missing or blank.
- **V3:** `category` is required and must be supplied in the same identifier
  format every existing category identifier already uses. Invalid when
  missing, or when the supplied value is not shaped like a valid category
  identifier — this is a shape check only, not a check that the category
  actually exists (see E1).

## 4. Error responses

- **E1 — Category invalid:** Triggered when the supplied category reference
  satisfies V3's shape check but does not correspond to any category
  currently in the system. The user is told the category is invalid.
  Distinguished from V3 (malformed reference) by the reference being
  correctly shaped, and from a successful response by no prompt being
  created and no prompt data being returned.

## 5. Acceptance criteria

- **AC1:** Given a title, prompt text, and an existing category are supplied,
  When the user creates a prompt, Then a new prompt is created and the
  response includes its id, category (id and name), title, prompt text,
  description, createdAt, and updatedAt.
- **AC2:** Given no description is supplied, When the user creates a prompt,
  Then the prompt is created and returned with no description value, rather
  than an error.
- **AC3:** Given the title is missing or blank, When the user attempts to
  create a prompt, Then the user is told the title is missing (V1), and no
  prompt is created.
- **AC4:** Given the prompt text is missing or blank, When the user attempts
  to create a prompt, Then the user is told the prompt text is missing (V2),
  and no prompt is created.
- **AC5:** Given the category reference is missing or not shaped like a valid
  category identifier, When the user attempts to create a prompt, Then the
  user is told the category reference is invalid (V3), and no prompt is
  created.
- **AC6:** Given the category reference is validly shaped but does not
  correspond to any existing category, When the user attempts to create a
  prompt, Then the user is told the category is invalid (E1), and no prompt
  is created.
- **AC7:** Given more than one of title, prompt text, and category reference
  are missing or invalid at once, When the user attempts to create a prompt,
  Then the user is told about every one of those problems together (V1/V2/V3),
  not only the first one found, and no prompt is created.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | What fields does a created prompt carry, and which are user-supplied vs system-assigned? | The same field set already established for reading a single prompt (`003-get-prompt` §2): id, category reference (id + name), title, prompt text, optional description, createdAt, updatedAt. `id`, `createdAt`, `updatedAt`, and `category.name` are assigned/derived by the system rather than supplied directly by the user. | Fixed §2 Fields table, marking each field's "Required at creation" status; added AC1/AC2. |
| 2 | How is a missing/empty title or prompt text reported? | The user is told which one is missing, as a distinct problem per field. | Added V1, V2, AC3, AC4. |
| 3 | How is an invalid category reference reported, and are "wrongly shaped" and "well-shaped but non-existent" the same problem? | No — they are two distinct problems. A category reference that isn't shaped like a valid identifier is a shape/format problem (V3); a correctly-shaped reference that matches no existing category is a separate business problem, reported as "the category is invalid" (E1), not conflated with the shape check and not treated as "resource not found" in the sense of opening an existing resource by id (contrast `003-get-prompt` E1, which is about a URL-addressed resource, not a body field). | Split into V3 (shape) and E1 (existence), each with its own AC (AC5, AC6). |
| 4 | Should several problems occurring at once (e.g. missing title and missing prompt) be reported one at a time or all together? | All together, in the same response — consistent with `004-request-validation-middleware`'s general rule that every failing piece of input is reported together, never only the first one encountered. | Added AC7. |
| 5 | Should this operation validate the category reference's format strictly (unlike `002-list-prompts`'s category filter, which is treated as an opaque value with no format validation)? | Yes — deliberately different from `002-list-prompts` Decision #4 (list filter): there, a non-matching filter value is a normal empty result; here, creating a prompt against a bad category reference is a rejected write, so both a malformed reference (V3) and a non-existent one (E1) must tell the user something went wrong. | Added V3 and E1, explicitly diverging from the list-time precedent of treating category values as opaque. |
