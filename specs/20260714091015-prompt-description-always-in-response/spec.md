# Spec: Always return the prompt description on create and update
Status: READY TO IMPLEMENT
Story: As an API client, I want the create-prompt and update-prompt responses to always include the prompt's description — as an explicit empty value when there is none — so that I can rely on a consistent response shape without special-casing a missing field.

<!--
Supersedes the response behavior for the description field established by the
create-prompt spec (specs/20260713111541-create-prompt) and the update-prompt spec
(specs/20260713152201-update-prompt), both IMPLEMENTED. Those specs are not edited.
This change is response-representation only; it does not alter how a description is
stored (Decision D1).
-->

## 1. Behavior
Main flow (create a prompt):
1. A client creates a prompt exactly as today (title, prompt text, category, and an
   optional description).
2. The returned stored prompt **always** carries a description field:
   - When a non-empty description was submitted, the field holds that text.
   - When no description was submitted, or the submitted description was empty, the
     field is returned as an explicit empty value (`null`).

Main flow (update a prompt):
1. A client updates a prompt exactly as today.
2. The returned stored prompt **always** carries a description field, following the
   same rule: the submitted non-empty text, or an explicit empty value (`null`) when
   the description was omitted or submitted empty.

Notes:
- "Empty" means either the description was omitted or it was submitted as empty text;
  both are returned as `null` (Decision D3).
- This spec changes only what the create and update responses **return**. It does not
  change how a description is stored: an omitted description is still stored as no
  value, and an empty description is still stored as empty text (Decision D1). As a
  result, a stored empty description and a stored no-description are both reported as
  `null` in these two responses.
- All other create/update behavior — validation, category-not-found, prompt-not-found,
  unexpected-failure handling, and every other returned field — is unchanged and
  inherited from the create-prompt and update-prompt specs.

Out of scope: any change to stored data or persistence; any change to input
validation; the listing and single-fetch responses (this spec covers only the create
and update responses); distinguishing a stored empty description from a stored
no-description in the response.

## 2. Fields
Client-facing field names are **snake_case**, unchanged from the create/update specs.
Only the description field's return contract changes:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| description | Free-text description of the prompt, as returned | text or explicit empty value (`null`) | Yes (always present in the response) | `null` when absent or empty |

<!-- Change vs. the prior specs: description was previously present in the response
only when a non-empty description existed; it is now always present, and is `null`
whenever the prompt has no non-empty description. -->

## 3. Validation rules
None. This change alters only how the description is represented in the create and
update responses; no input validation rule is added or changed. The input rules for
both endpoints remain exactly as defined by the create-prompt and update-prompt specs.

## 4. Error responses
None. No error response is added, removed, or changed; all existing create/update
error behavior is inherited unchanged.

## 5. Acceptance criteria
- **AC1** — Given a create request that omits the description, When the client creates
  the prompt, Then the response body includes a description field whose value is the
  explicit empty value (`null`).
- **AC2** — Given a create request whose description is empty text, When the client
  creates the prompt, Then the response body includes a description field whose value
  is the explicit empty value (`null`), and the stored prompt is unaffected by this
  change (its description is still stored as empty text).
- **AC3** — Given an update request that omits the description, When the client updates
  the prompt, Then the response body includes a description field whose value is the
  explicit empty value (`null`).
- **AC4** — Given an update request whose description is empty text, When the client
  updates the prompt, Then the response body includes a description field whose value
  is the explicit empty value (`null`), while the stored prompt still keeps the empty
  text (persistence is unchanged).

<!-- The "non-empty description submitted → that text is returned" behavior is
unchanged from the create-prompt/update-prompt specs and remains covered by their
existing regression tests; it is intentionally not restated as a new AC here. -->

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | Where should the empty→null normalization live? | The response boundary only — the returned description collapses empty to a null value; stored data and the business logic are untouched. | §1 Notes & Out of scope; §3; AC2/AC4 keep persistence unchanged. |
| D2 | When the prompt has no description, what should the response show? | The description field is always present and carries an explicit empty value (`null`) rather than being omitted. | §1 both flows; §2 Fields; AC1/AC3. |
| D3 | When a client explicitly submits an empty-text description, what should the response show? | The same explicit empty value (`null`) — an empty submitted description and an absent one are reported identically. | §1 Notes; AC2/AC4; supersedes the update-prompt response behavior that echoed empty text back verbatim. |
