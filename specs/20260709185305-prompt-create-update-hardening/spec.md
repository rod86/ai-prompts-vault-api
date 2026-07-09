# Spec: Harden the prompt module's create and update operations
Status: IMPLEMENTED
Story: As a developer maintaining the prompt module, I want the create and update
operations to avoid unnecessary lookups, surface persistence failures as their own
distinguishable errors, keep the creation operation's save step working from only the
minimal category reference it needs, and keep the module's internal folder naming
consistent with the shared module, so that the module performs better, fails more
informatively, and stays structurally consistent with the rest of the codebase.

This spec builds on the already-completed `specs/20260709161627-rebuild-prompt-module/`
(`Status: IMPLEMENTED`), which first rebuilt the prompt and category management
capability in the current module structure. That folder's record is not reopened; this
work refines the create/update operations and infrastructure layout it left in place.

## 1. Behavior

Main flow — updating a prompt whose category does not change:
- When an existing prompt is updated and the requested category is the same one it
  already has, the category's existence is not re-checked — the update proceeds using
  the category the prompt already carries.

Main flow — updating a prompt whose category does change (unchanged from today):
- When an existing prompt is updated and the requested category differs from the one
  it already has, the new category's existence is checked exactly as before: if it
  doesn't exist, the category-invalid error is raised and nothing changes.

Main flow — creating a prompt:
- Assembling a prompt to hand back to the caller (with a full category reference) stays
  separate from saving that prompt to storage: the save step is given only the minimal
  category reference it needs (the category's identifier), not the category's full
  details.

Alternate flow — persistence failure on create:
- If the underlying store fails while saving a newly created prompt, that failure is
  surfaced as its own distinguishable error, separate from the category-invalid error.

Alternate flow — persistence failure on update:
- If the underlying store fails while saving an updated prompt, that failure is
  surfaced as its own distinguishable error, separate from the category-invalid and
  prompt-not-found errors.

Structural consistency:
- The module's internal folder that holds its storage-adapter code is named the same
  way as the shared module's equivalent folder. This is a structural change only —
  behavior is unchanged.

Out of scope (deferred / explicitly excluded):
- No change to what a prompt looks like, what fields it has, or how it is listed,
  retrieved, or deleted.
- No change to the category-invalid or prompt-not-found error conditions themselves —
  only to when the category check runs, and to two new, separate persistence-failure
  conditions.
- No change to the legacy, currently-live implementation this module coexists with, or
  to anything wired to it — this module is not yet reachable from any route.
- Reopening or editing `specs/20260709161627-rebuild-prompt-module/`'s own record.

## 2. Fields
None. This work introduces no new data fields, request payloads, or persisted records.

## 3. Validation rules
- **V1** — Updating a prompt whose requested category matches the category it already
  has does not re-check that category's existence; the update proceeds using the
  category the prompt already carries. This is safe: a category cannot be removed
  from the system while any prompt still references it, so the prompt's current
  category is guaranteed to still exist.
- **V2** — Updating a prompt whose requested category differs from the one it already
  has still checks the new category's existence, exactly as before.
- **V3** — A failure while saving a newly created prompt is surfaced as its own error,
  distinguishable from the category-invalid error.
- **V4** — A failure while saving an updated prompt is surfaced as its own error,
  distinguishable from both the category-invalid and prompt-not-found errors.
- **V5** — The module's storage-adapter folder is named consistently with the shared
  module's equivalent folder; no behavior changes as a result.
- **V6** — Creating a prompt keeps assembling-for-the-caller and saving-to-storage as
  separate steps, with the save step given only the category's identifier, not its full
  details.
- **V7** — The project's automated quality gates (lint including architecture-boundary
  checks, type-checking, and the full test suite) pass.

## 4. Error responses
- **E1** — Category-invalid (existing, unchanged): raised when a prompt is created or
  updated against a category reference that doesn't exist. For updates, this only
  triggers when the requested category differs from the one the prompt already has
  (V2).
- **E2** — Prompt-not-found (existing, unchanged): raised when an update or delete
  targets a prompt that doesn't exist.
- **E3** — Create-save-failed (new): raised when the underlying store fails while
  saving a newly created prompt. Distinguishable from E1.
- **E4** — Update-save-failed (new): raised when the underlying store fails while
  saving an updated prompt. Distinguishable from E1 and E2.

## 5. Acceptance criteria
- **AC1** — *Unchanged category skips the check.* Given an existing prompt, When it is
  updated with the same category id it already has, Then the category's existence is
  not checked and the update proceeds using the category the prompt already carries.
  (covers V1)
- **AC2** — *Changed category still checked, valid case.* Given an existing prompt,
  When it is updated with a different category id that exists, Then that category is
  looked up and used. (covers V2)
- **AC3** — *Changed category still checked, invalid case.* Given an existing prompt,
  When it is updated with a different category id that does not exist, Then the
  category-invalid error (E1) is raised and nothing is changed. (covers V2, E1)
- **AC4** — *Create-save failure.* Given a valid new prompt, When the underlying store
  fails while saving it, Then the create-save-failed error (E3) is raised, distinct
  from the category-invalid error. (covers V3, E3)
- **AC5** — *Update-save failure.* Given a valid update to an existing prompt, When the
  underlying store fails while saving it, Then the update-save-failed error (E4) is
  raised, distinct from the category-invalid and prompt-not-found errors. (covers V4,
  E4)
- **AC6** — *Folder naming consistency.* Given the module's storage-adapter folder,
  When it is inspected, Then it is named the same way as the shared module's
  equivalent folder, and its behavior is unchanged. (covers V5)
- **AC7** — *Minimal reference on save.* Given a new prompt being created, When it is
  handed to the save step, Then that step receives only the category's identifier, not
  its full details, while the value handed back to the caller still carries the full
  category. (covers V6)
- **AC8** — *Quality gates pass.* Given the change is complete, When the project's
  lint, type-check, and full test suite are run, Then all pass. (covers V7)

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | -------------------- |
| 1 | Should there be one shared persistence-error class used by both the create and update operations, or a separate error class per operation? | A separate error class per operation. | Drives E3/E4 being two distinct errors rather than one shared one; carried into plan.md as two classes. |
| 2 | Should the two new persistence-failure errors preserve the original underlying error (e.g. via the standard `cause` mechanism), or just carry a static message? | Capture the original error as the cause. | V3/V4 (and AC4/AC5) require the new errors to wrap, not discard, the original failure; drives the error shape in plan.md. |
| 3 | When updating a prompt with an unchanged category id, if that category was deleted in the meantime, should the update still succeed (trusting it existed before), or should some other safeguard apply? | The update still succeeds regardless — skipping the lookup means skipping validation too. | Drove V1's explicit "even if that category no longer exists" clause and the §1 "stale category" alternate flow (both superseded — see Decision 4). |
| 4 | (Correction, raised by the user) Does the fact that a category in use can't be deleted — a system invariant — make the "stale category" concern in Decision 3 moot? | Yes — a category referenced by any prompt cannot be removed from the system, so this scenario cannot occur. | Removed the §1 "stale category" alternate flow and corrected V1's rationale: skipping the check is safe by construction, not a trade-off. Decision 3 is left as the historical record of what was asked/answered before this correction surfaced. |
