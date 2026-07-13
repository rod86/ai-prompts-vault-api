# Spec: Create prompt
Status: READY TO IMPLEMENT
Story: As an API client, I want to create a prompt by submitting its details so that it is saved and returned to me as a stored prompt.

## 1. Behavior
Main flow:
1. The client submits a new prompt with a title, the prompt text, the category it
   belongs to, and optionally a description.
2. The system checks the submitted details satisfy the input rules (§3).
3. The system confirms the referenced category exists.
4. The system stores the prompt as a new record, assigning it its own identifier
   and recording when it was created and last updated.
5. The system returns the newly created prompt as a stored prompt: its identifier,
   title, prompt text, description (when one was given), the category it belongs to
   (identifier and name), and its creation and last-updated moments. The response
   indicates a new resource was created.

Alternate flow (invalid input):
- If any submitted detail breaks an input rule (§3), the prompt is not created and
  the client is told the request failed validation, with a per-field reason for each
  offending field.

Alternate flow (category does not exist):
- If the input is well-formed but the referenced category does not exist, the prompt
  is not created and the client is told the referenced category could not be found.
  This is reported distinctly from an input-validation failure.

Alternate flow (unexpected failure):
- If storing the prompt fails unexpectedly (not an input or category problem), the
  client is told a generic internal error occurred.

Out of scope: authentication/authorization (the endpoint is public); ownership of a
prompt by a user (prompts are not owned); updating, listing, or deleting prompts;
creating categories; length caps or trimming/normalization of text fields;
idempotency/duplicate detection.

## 2. Fields
All client-facing field names — both submitted and returned — are **snake_case**
(Decision D7).

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| title | Human-readable name of the prompt | text | Yes | — |
| prompt | The prompt text itself | text | Yes | — |
| category_id | Identifier of the category the prompt belongs to | text (identifier) | Yes | — |
| description | Optional free-text description of the prompt | text | No | — (absent) |

Returned in addition to the above (assigned by the system, not submitted):
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier assigned to the new prompt | text (identifier) | Yes | — |
| category | The category the prompt belongs to, as its identifier and name | { id: text, name: text } | Yes | — |
| created_at | Moment the prompt was created | date | Yes | — |
| updated_at | Moment the prompt was last updated | date | Yes | — |

<!-- On success the submitted category_id is echoed back expanded into the full category
(id + name). description is present in the response only when it was submitted. The
nested category's own keys (id, name) are single words, unaffected by snake_case. -->

## 3. Validation rules
- **V1** — `title` is required and must be a text value.
- **V2** — `prompt` is required and must be a text value.
- **V3** — `category_id` is required and must be a well-formed identifier (the same
  identifier shape the system assigns to categories). A value that is not a
  well-formed identifier is an input-validation failure (→ E1), decided before any
  category-existence check.
- **V4** — `description`, when present, must be a text value; it may be omitted.
- **V5** — The category named by a well-formed `category_id` must exist. A well-formed
  but unknown `category_id` is **not** an input-validation failure; it is the
  category-not-found condition (→ E2).

<!-- Empty text is accepted for title/prompt/description: the only text-field rule is
"is a text value" (no trimming, no non-empty or length constraints) — Decision D3. -->

## 4. Error responses
- **E1 — Request validation failed.** Trigger: one or more submitted details break an
  input rule (V1–V4) — e.g. a missing/empty required field, a non-text value, or a
  `category_id` that is not a well-formed identifier. The client is told the request
  failed validation, with the offending fields each paired with a human-readable
  reason (keyed by their snake_case names), grouped under the body. The prompt is not
  created. Distinguished from E2/E3
  by being labelled a request-validation failure and carrying per-field reasons.
- **E2 — Category not found.** Trigger: input is well-formed but the referenced
  category does not exist (V5). The client is told the referenced category could not
  be found, identifying it. The prompt is not created. Distinguished from E1 by
  being labelled a category-not-found failure with no per-field reasons, and from E3
  by naming the missing category rather than a generic internal error.
- **E3 — Unexpected internal failure.** Trigger: storing the prompt fails for a reason
  other than E1/E2. The client is told a generic internal error occurred.
  Distinguished from E1/E2 by its internal-error label and the absence of both
  per-field reasons and a category reference.

## 5. Acceptance criteria
- **AC1** — Given a well-formed request whose category exists, When the client creates
  a prompt, Then the prompt is stored with a newly assigned identifier and creation/
  last-updated moments, and the response indicates a new resource was created and
  contains the stored prompt: id, title, prompt text, description (only when
  submitted), the category as id and name, created_at and updated_at. *(covers V1, V2,
  V3, V4, V5 happy path)*
- **AC2** — Given a request that omits a required field, sends a non-text value, or
  sends a `category_id` that is not a well-formed identifier, When the client attempts
  to create a prompt, Then the request is rejected as a validation failure whose
  reasons name each offending field (by its snake_case name) with a human-readable
  reason grouped under the body, and no prompt is stored. *(covers V1, V2, V3, V4, E1)*
- **AC3** — Given a well-formed request whose `category_id` is a valid identifier that
  matches no existing category, When the client attempts to create a prompt, Then the
  request is rejected as a category-not-found failure that names the missing category,
  distinct from a validation failure and without per-field reasons, and no prompt is
  stored. *(covers V5, E2)*
- **AC4** — Given a well-formed request whose category exists but whose storage fails
  unexpectedly, When the client attempts to create a prompt, Then the client is told a
  generic internal error occurred, distinct from a validation or category-not-found
  failure. *(covers E3)*

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | On success, what does the endpoint return? | Created status with the full stored prompt in the body (id, title, prompt, description, category {id, name}, createdAt, updatedAt) — what the existing create use case already returns. | §1 main flow step 5; §2 returned fields; AC1. |
| D2 | When the body is well-formed but `categoryId` references a non-existent category, how does the endpoint respond? | Reject as a category-not-found failure, reported distinctly from a validation failure and naming the missing category. | §1 category-not-exist flow; V5; E2; AC3. |
| D3 | What rules apply to the text fields title/prompt/description? | Required-only: title & prompt must be present text values, description optional text; empty allowed, no trimming, no length caps. | V1, V2, V4; §2; Out of scope (length/trim). |
| D4 | How is `categoryId` validated at the input stage? | Must be a well-formed identifier (same shape the system assigns categories); a malformed value is an input-validation failure, decided before the existence check. | V3; E1; AC2 (malformed → E1) vs AC3 (well-formed unknown → E2). |
| D5 | Should the endpoint require authentication? | No — the endpoint is public, consistent with existing endpoints; prompts are not owned by a user. | §1 Out of scope. |
| D6 | For the category-not-found response, what label identifies the error? | The error's own name verbatim (with its full name), consistent with the existing validation-failure envelope. | E2 wording; realized concretely in plan §3. |
| D7 | What casing do the client-facing (submitted and returned) field names use? | snake_case — so `categoryId`→`category_id`, `createdAt`→`created_at`, `updatedAt`→`updated_at` on the wire; single-word names (title, prompt, description, id, category, name) are unchanged. The domain use case stays camelCase, so the HTTP handler maps snake_case⇄camelCase at the boundary (mapping done inline in the handler — plan §2/§7). | §2 Fields; V3; E1; AC1–AC3; plan §2/§3/§5/§8. |
