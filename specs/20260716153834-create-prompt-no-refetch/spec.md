# Spec: Create prompt without re-reading the created prompt
Status: READY TO IMPLEMENT
Story: As a prompt author, I want the create-prompt flow to return my newly created prompt assembled from the data already at hand so that creation is simpler and has no failure mode where a just-created prompt cannot be found.

## 1. Behavior

Main flow (creation itself is existing behavior — see specs/20260713111541-create-prompt
and specs/20260714142121-create-prompt-auth-creator; this spec changes how the returned
prompt is produced):

1. An authenticated user submits a new prompt (title, prompt text, category, optional
   description).
2. The system verifies the referenced category exists.
3. The system looks up the creator's details (their name) — **new**: the creator's
   details are obtained directly, not by re-reading the stored prompt afterwards.
4. The prompt is stored with the authenticated user as its creator.
5. The user receives the complete created prompt — assembled from the submitted data,
   the category's details, the creator's details, and the generated identifier and
   timestamps — **without reading the stored prompt back**. The received prompt is
   identical to what was stored.

Alternate flows:

- The referenced category does not exist → the creation is rejected with a
  "category not found" error; nothing is stored (existing behavior, unchanged).
- The creator's user record does not exist (an integrity anomaly — the user was
  verified during authentication but has since disappeared) → the creation is rejected
  with a "user not found" error; nothing is stored (**new**: previously this surfaced
  as a generic internal failure).
- Storage rejects the creation → an internal creation failure preserving the
  underlying cause (existing behavior, unchanged).

What the user observes on success is unchanged: the same created-prompt shape with the
same values as before this change.

## 2. Fields

No new or changed input fields — the create-prompt submission is exactly as specified in
specs/20260713111541-create-prompt. The returned prompt (unchanged shape, listed for
traceability):

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| identifier | The created prompt's unique id | text (generated) | yes | generated |
| title | Prompt title as submitted | text | yes | — |
| prompt | Prompt text as submitted | text | yes | — |
| description | Optional description as submitted | text | no | absent |
| category | Referenced category's id and name | id + text | yes | — |
| creator | Creating user's id and name | id + text | yes | authenticated user |
| created / updated | Creation and last-update instants | date | yes | creation instant |

## 3. Validation rules

- **V1** (existing, unchanged): the referenced category must exist. Invalid = no
  category with the submitted category identifier.
- **V2** (new, previously implicit): the creator must exist as a registered user at
  creation time. Invalid = no user record for the authenticated user's identifier.

## 4. Error responses

- **E1** (existing, unchanged): category does not exist (V1) → "category not found"
  identifying the requested category; distinguished by its own error code.
- **E2** (new): creator does not exist (V2) → "user not found" identifying the user;
  distinguished by its own error code, different from E1's.
- **E3** (existing, unchanged): storage rejects the creation → generic internal
  failure to the user; the underlying cause is preserved internally, never exposed.

## 5. Acceptance criteria

- **AC1**: Given an authenticated user, an existing category, and valid prompt data,
  when the user creates the prompt, then they receive the complete created prompt —
  identifier, title, prompt text, description, category id and name, creator id and
  name, and creation/update timestamps — matching exactly what was stored.
- **AC2**: Given a prompt creation succeeds, when the created prompt is returned, then
  it was assembled from the data already at hand and the stored prompt was **not** read
  back after being stored.
- **AC3**: Given a category that does not exist, when the user creates a prompt, then
  they receive the "category not found" error (E1), nothing is stored, and the
  creator's details are not looked up.
- **AC4**: Given the creator's user record does not exist, when the user creates a
  prompt, then they receive the "user not found" error (E2) and nothing is stored.
- **AC5**: Given storage rejects the creation, when the user creates a prompt, then the
  creation fails as a generic internal failure (E3) preserving the underlying cause
  internally.
- **AC6**: Given valid prompt data with no description, when the user creates the
  prompt, then the created prompt they receive has no description.
- **AC7**: Given an authenticated user creating a prompt end to end, when the creation
  succeeds, then the received prompt (shape and values, including the creator's name)
  is identical to what this flow returned before this change.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Where should the creator's name come from once the post-create re-read is removed? (fetch creator during creation / carry name in the authentication context / drop creator name from the result) | Fetch the creator's details during creation, via a dedicated user lookup owned by the prompt area | Behavior step 3; V2 becomes an explicit rule; enables AC1/AC2 |
| 2 | If the creator's user record cannot be found during creation (integrity anomaly), what should the user see? (generic internal failure preserving today's contract / a new distinct "user not found" error) | A new distinct "user not found" unprocessable error | Adds E2 and AC4; alternate flow for a missing creator |
