# Spec: Update prompt
Status: IMPLEMENTED
Story: As an API client, I want to update an existing prompt by submitting its new details so that the stored prompt is replaced with the new values and returned to me.

## 1. Behavior
Main flow:
1. The client identifies an existing prompt and submits its new details: a title,
   the prompt text, the category it belongs to, and optionally a description.
2. The system checks the submitted details satisfy the input rules (§3).
3. The system confirms the identified prompt exists.
4. The system confirms the referenced category exists.
5. The system replaces the stored prompt's title, prompt text, category, and
   description with the submitted values, recording when it was last updated. Its
   identifier and original creation moment are preserved.
6. The system returns the updated prompt as a stored prompt: its identifier, title,
   prompt text, description (when one was given), the category it belongs to
   (identifier and name), and its creation and last-updated moments. The response
   indicates the existing resource was updated successfully.

Alternate flow (invalid input):
- If any submitted detail breaks an input rule (§3), the prompt is not updated and
  the client is told the request failed validation, with a per-field reason for each
  offending field.

Alternate flow (prompt does not exist):
- If the input is well-formed but the identified prompt does not exist, nothing is
  updated and the client is told the prompt could not be found. This is reported
  distinctly from an input-validation failure and from a category-not-found failure.

Alternate flow (category does not exist):
- If the input is well-formed and the prompt exists, but the referenced category does
  not exist, the prompt is not updated and the client is told the referenced category
  could not be found. This is reported distinctly from an input-validation failure and
  from a prompt-not-found failure.

Alternate flow (unexpected failure):
- If storing the update fails unexpectedly (not an input, prompt, or category
  problem), the client is told a generic internal error occurred.

Out of scope: authentication/authorization (the endpoint is public); ownership of a
prompt by a user (prompts are not owned); partial updates (every update is a full
replacement of title, prompt, category, and description); creating, listing, or
deleting prompts; creating categories; length caps or trimming/normalization of text
fields; changing the prompt's identifier or creation moment.

## 2. Fields
All client-facing field names — the path identifier, submitted body, and returned
fields — are **snake_case** (Decision D8, mirroring create-prompt D7).

Path identifier (identifies which prompt to update):
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Identifier of the prompt to update | text (identifier) | Yes | — |

Submitted body:
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| title | Human-readable name of the prompt | text | Yes | — |
| prompt | The prompt text itself | text | Yes | — |
| category_id | Identifier of the category the prompt belongs to | text (identifier) | Yes | — |
| description | Optional free-text description of the prompt | text | No | — (cleared) |

Returned (the full stored prompt):
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Identifier of the prompt (unchanged) | text (identifier) | Yes | — |
| category | The category the prompt belongs to, as its identifier and name | { id: text, name: text } | Yes | — |
| created_at | Moment the prompt was originally created (preserved) | date | Yes | — |
| updated_at | Moment the prompt was last updated (set to now) | date | Yes | — |

<!-- On success the submitted category_id is echoed back expanded into the full category
(id + name). description is present in the response only when it was submitted; omitting
it clears any previously stored description. The nested category's own keys (id, name)
are single words, unaffected by snake_case. -->

## 3. Validation rules
- **V1** — `id` (path) is required and must be a well-formed identifier (the same
  identifier shape the system assigns to prompts). A value that is not a well-formed
  identifier is an input-validation failure (→ E1), decided before any
  prompt-existence check.
- **V2** — `title` is required and must be a text value.
- **V3** — `prompt` is required and must be a text value.
- **V4** — `category_id` is required and must be a well-formed identifier. A value
  that is not a well-formed identifier is an input-validation failure (→ E1), decided
  before any category-existence check.
- **V5** — `description`, when present, must be a text value; it may be omitted.
- **V6** — The prompt named by a well-formed `id` must exist. A well-formed but
  unknown `id` is **not** an input-validation failure; it is the prompt-not-found
  condition (→ E2).
- **V7** — The category named by a well-formed `category_id` must exist. A well-formed
  but unknown `category_id` is **not** an input-validation failure; it is the
  category-not-found condition (→ E3). Checked after the prompt-existence check (V6).

<!-- Empty text is accepted for title/prompt/description: the only text-field rule is
"is a text value" (no trimming, no non-empty or length constraints) — mirrors
create-prompt D3. -->

## 4. Error responses
- **E1 — Request validation failed.** Trigger: one or more submitted details break an
  input rule (V1–V5) — e.g. a malformed path `id`, a missing/non-text required field,
  or a `category_id` that is not a well-formed identifier. The client is told the
  request failed validation, with the offending fields each paired with a
  human-readable reason (keyed by their snake_case names), grouped under the request
  part they belong to (path vs body). The prompt is not updated. Distinguished from
  E2/E3/E4 by being labelled a request-validation failure and carrying per-field
  reasons.
- **E2 — Prompt not found.** Trigger: input is well-formed but the identified prompt
  does not exist (V6). The client is told the prompt could not be found, identifying
  it. Nothing is updated. Distinguished from E1 by being labelled a prompt-not-found
  failure with no per-field reasons, from E3 by naming the missing prompt rather than a
  missing category, and from E4 by naming the missing prompt rather than a generic
  internal error.
- **E3 — Category not found.** Trigger: input is well-formed and the prompt exists, but
  the referenced category does not exist (V7). The client is told the referenced
  category could not be found, identifying it. The prompt is not updated. Distinguished
  from E1 by having no per-field reasons, from E2 by naming the missing category rather
  than the missing prompt, and from E4 by naming the missing category rather than a
  generic internal error.
- **E4 — Unexpected internal failure.** Trigger: storing the update fails for a reason
  other than E1/E2/E3. The client is told a generic internal error occurred.
  Distinguished from E1/E2/E3 by its internal-error label and the absence of both
  per-field reasons and any prompt/category reference.

## 5. Acceptance criteria
- **AC1** — Given a well-formed request whose prompt and category both exist, When the
  client updates the prompt, Then the stored prompt's title, prompt text, category, and
  description are replaced with the submitted values and its last-updated moment is set
  to now, while its identifier and creation moment are preserved, and the response
  indicates the resource was updated successfully and contains the stored prompt: id,
  title, prompt text, description (only when submitted), the category as id and name,
  created_at and updated_at. *(covers V1, V2, V3, V4, V5, V6, V7 happy path)*
- **AC2** — Given a request with a malformed path `id`, an omitted or non-text required
  body field, or a `category_id` that is not a well-formed identifier, When the client
  attempts to update a prompt, Then the request is rejected as a validation failure
  whose reasons name each offending field (by its snake_case name) with a
  human-readable reason grouped under its request part, and nothing is updated.
  *(covers V1, V2, V3, V4, V5, E1)*
- **AC3** — Given a well-formed request whose path `id` is a valid identifier that
  matches no existing prompt, When the client attempts to update a prompt, Then the
  request is rejected as a prompt-not-found failure that names the missing prompt,
  distinct from a validation failure and without per-field reasons, and nothing is
  updated. *(covers V6, E2)*
- **AC4** — Given a well-formed request whose prompt exists but whose `category_id` is a
  valid identifier that matches no existing category, When the client attempts to update
  a prompt, Then the request is rejected as a category-not-found failure that names the
  missing category, distinct from a validation failure and from a prompt-not-found
  failure and without per-field reasons, and nothing is updated. *(covers V7, E3)*
- **AC5** — Given a well-formed request whose prompt and category both exist but whose
  storage fails unexpectedly, When the client attempts to update a prompt, Then the
  client is told a generic internal error occurred, distinct from a validation,
  prompt-not-found, or category-not-found failure. *(covers E4)*

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | What HTTP method and request shape should the update endpoint expose? | `PUT /prompts/:id` with a full body (title, prompt, category_id required; description optional) — full replacement, mirroring `POST /prompts`; matches the existing `UpdatePromptUseCase`. | §1 main flow; §2 Fields; Out of scope (partial updates). |
| D2 | On a successful update, what should the endpoint return? | `200 OK` with the full updated prompt in the body (id, title, prompt, description when present, category {id, name}, created_at, updated_at). | §1 main flow steps 5–6; §2 returned fields; AC1. |
| D3 | How should the path `id` be handled, and what happens when the prompt does not exist? | Validate `id` as a well-formed identifier: a malformed id is a 400 validation failure decided before the existence check (mirrors create-prompt D4); a well-formed but unknown id returns a distinct not-found failure. | V1; V6; E1; E2; AC2 (malformed → E1) vs AC3 (well-formed unknown → E2). |
| D4 | (Trivial, mirrors create-prompt D2/D6) When the body is well-formed and the prompt exists but `category_id` references a non-existent category, how does the endpoint respond? | Reject as a category-not-found failure, reported distinctly, naming the missing category — reusing the existing category-not-found handling. | §1 category-not-exist flow; V7; E3; AC4. |
| D5 | (Trivial, mirrors create-prompt D3) What rules apply to the text fields title/prompt/description? | Required-only: title & prompt must be present text values, description optional text; empty allowed, no trimming, no length caps. | V2, V3, V5; §2. |
| D6 | (Trivial, mirrors create-prompt D5) Should the endpoint require authentication? | No — the endpoint is public, consistent with existing endpoints; prompts are not owned by a user. | §1 Out of scope. |
| D7 | (Trivial) When the prompt exists but the referenced category is unchanged, is the category re-verified? | No — an unchanged category is reused as-is without a lookup (existing use-case behavior); only a changed category_id triggers an existence check. This is an internal optimization with no client-visible effect. | V7 realized in plan §5. |
| D8 | (Trivial, mirrors create-prompt D7) What casing do the client-facing (path, submitted, returned) field names use? | snake_case — `category_id`, `created_at`, `updated_at` on the wire; single-word names (id, title, prompt, description, category, name) unchanged. The domain use case stays camelCase, so the HTTP handler maps snake_case⇄camelCase at the boundary. | §2 Fields; V1, V4; E1; AC1–AC4; plan §2/§3/§5/§8. |
| D9 | (Revision — the `testing-practices` and `node-express-typescript` skills were updated after this spec was authored) How far should this plan reconcile with the latest skills? The updated `node-express-typescript` skill adds request-validation *test-structure* guidance and illustrates it with a flat `{ errors: [{ field, error }] }` shape — but that shape is only an **example**, not a prescribed envelope; its actual rule is "assert only the fields a test exercises and their messages, whatever envelope the project ships." | Keep the app's shipped `{ error, message, details }` validation envelope (the skill's flat shape is illustrative only, and this envelope is consistent with the already-IMPLEMENTED create-prompt endpoint — no shared-middleware change, no cross-endpoint divergence). Reconcile with the skills' updated *test-structure* conventions: fixture lifetimes (shared parent in `beforeAll`/`afterAll`, per-test child inside each `it`, `fixture<Entity>` naming), exact whole-body `toEqual` assertions (no partial-match + follow-up `not.toHaveProperty` pairing), distinct nullable-field states (description omitted→cleared/`null` vs `''`→present), pinned error precedence (prompt-not-found before category-not-found), and validation cases grouped in a nested `Request Validation` describe that — per the skill's generic point — assert **only** the offending `details.<part>.<field>`, not the status or full envelope. No feature behavior changes; E1's envelope is unchanged. | plan §7/§8/§9; tasks preamble + T2, new T3 (`''` state), new T9 (precedence); no change to §1–§5 behavior. |
