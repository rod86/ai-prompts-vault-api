# Spec: Rebuild the prompt management capability in the current module structure
Status: IMPLEMENTED
Story: As a developer, I want the prompt and category management capability rebuilt inside the project's current module structure, coexisting with its existing implementation, so that a verified, current-standards foundation exists for retiring the existing implementation later.

## 1. Behavior

The prompt and category management capability — listing categories, listing prompts
(optionally filtered by category), retrieving a single prompt, creating a prompt,
updating a prompt, and deleting a prompt — is already fully specified by
`001-list-categories`, `002-list-prompts`, `003-get-prompt`, `005-create-prompt`,
`006-update-prompt`, and `007-delete-prompt`. This work does not change what that
capability does or how it behaves for a user; it rebuilds its internal implementation
to follow the project's current architecture guidelines, and does not yet replace the
implementation the running application actually uses.

**Main flow:** Every operation of the capability listed above is rebuilt so that it
produces the exact same results, in the exact same situations, as it already does today
— including every error situation. The rebuilt version is not yet reachable by a user;
the existing implementation keeps handling every request exactly as before.

**Alternate flow — identifier and timestamp assignment moves inside the capability:**
Today, when a prompt is created or updated, the prompt's unique identifier and its
creation/last-updated moment are handed to the capability from outside it. In the
rebuilt version, the capability produces these itself when the operation happens. This
is purely internal: the values produced are still a unique identifier and the current
date/time, exactly as before — there is no observable difference in what a user would
see, and since the rebuilt version isn't reachable yet, there is nothing to observe from
outside at all in this iteration.

**Coexistence flow (interim):** The existing implementation of this capability remains
present and unchanged, and keeps handling every request exactly as it does today. The
rebuilt version exists alongside it. Duplication is accepted for this period, the same
way it already was when the project's shared cross-cutting capabilities were rebuilt
ahead of this work.

**Out of scope (deferred to a future spec):**
- Making the rebuilt version the one that actually handles requests (retiring the
  existing implementation's wiring to the parts of the system that call into it).
- Removing the existing implementation.
- Any change to the fields returned to a user, beyond what `003-get-prompt` /
  `005-create-prompt` already define — this work does not introduce a different shape.

## 2. Fields

None new. This work rebuilds the internal implementation of the field set already
defined for a prompt (`003-get-prompt` §2, `005-create-prompt` §2) and a category
(`001-list-categories` §2) — those fields, their meanings, and their domain types are
unchanged.

## 3. Validation rules

- **V1** — The read operations of this capability (list categories, list prompts
  optionally filtered by category, retrieve a single prompt) are reachable from the
  rebuilt implementation and return the same results, for the same underlying data, as
  the existing implementation described in `001-list-categories`, `002-list-prompts`,
  and `003-get-prompt`.
- **V2** — The write operations of this capability (create a prompt, update a prompt,
  delete a prompt) are reachable from the rebuilt implementation and behave identically
  — same inputs accepted, same resulting prompt, same errors — to the existing
  implementation described in `005-create-prompt`, `006-update-prompt`, and
  `007-delete-prompt`.
- **V3** — A category reference that is validly shaped but does not correspond to any
  existing category is rejected the same way by the rebuilt create and update
  operations as it is today (see E1).
- **V4** — A prompt identifier that does not correspond to any existing prompt is
  rejected the same way by the rebuilt retrieve, update, and delete operations as it is
  today (see E2).
- **V5** — A prompt's unique identifier and its creation moment are produced by the
  rebuilt capability itself when a prompt is created, and its last-updated moment is
  produced by the rebuilt capability itself when a prompt is updated, rather than being
  supplied to it from outside — an internal change with no observable difference in the
  values produced (still a unique identifier, still the current date/time).
- **V6** — Contracts (the abstract description of each operation this capability
  offers) are kept separate from their concrete implementations, per the project's
  current architecture guidelines.
- **V7** — The existing implementation of this capability, and everything that
  currently depends on it, remains completely unchanged by this work.
- **V8** — This work introduces no change to how prompt or category data is stored.

## 4. Error responses

- **E1 — Category invalid.** Triggered by the rebuilt create/update operations under
  the same condition as today: a validly-shaped category reference that matches no
  existing category (`005-create-prompt` §4 E1, `006-update-prompt`). The user is told
  the category is invalid; no prompt is created or changed.
- **E2 — Prompt not found.** Triggered by the rebuilt retrieve/update/delete operations
  under the same condition as today: a prompt identifier that matches no existing
  prompt (`003-get-prompt`, `006-update-prompt`, `007-delete-prompt`). The user is told
  the prompt was not found; nothing is changed.

## 5. Acceptance criteria

- **AC1** — Given the rebuilt implementation, When categories are listed, Then the
  same categories are returned as `001-list-categories` describes. (covers V1)
- **AC2** — Given the rebuilt implementation, When prompts are listed, optionally
  filtered by category, Then the same prompts are returned as `002-list-prompts`
  describes — including a category filter that is malformed or matches no category
  simply returning no results, never an error. (covers V1)
- **AC3** — Given the rebuilt implementation, When a single prompt is retrieved by id,
  Then the same prompt is returned, or the prompt-not-found error (E2) is raised if it
  doesn't exist, exactly as `003-get-prompt` describes. (covers V1, V4, E2)
- **AC4** — Given the rebuilt implementation, When a prompt is created with a title,
  prompt text, an existing category, and an optional description, Then a new prompt is
  created with a self-assigned unique identifier and creation/last-updated moment, as
  `005-create-prompt` describes. (covers V2, V5)
- **AC5** — Given the rebuilt implementation, When a prompt is created against a
  category reference that doesn't exist, Then the category-invalid error (E1) is
  raised and no prompt is created, as `005-create-prompt` describes. (covers V2, V3, E1)
- **AC6** — Given the rebuilt implementation, When an existing prompt is updated, Then
  its fields are updated and its last-updated moment is refreshed by the capability
  itself, as `006-update-prompt` describes. (covers V2, V5)
- **AC7** — Given the rebuilt implementation, When an update targets a prompt or a
  category that doesn't exist, Then the prompt-not-found error (E2) or the
  category-invalid error (E1) is raised respectively and nothing is changed, as
  `006-update-prompt` describes. (covers V2, V3, V4, E1, E2)
- **AC8** — Given the rebuilt implementation, When an existing prompt is deleted, Then
  it no longer exists; When a nonexistent prompt is targeted, Then the prompt-not-found
  error (E2) is raised, as `007-delete-prompt` describes. (covers V2, V4, E2)
- **AC9** — Given this work is complete, When the existing implementation and
  everything that depends on it are inspected, Then they are unchanged and their tests
  still pass; When the project's automated quality checks are run, Then all of them
  pass and no change to stored data is required. (covers V6, V7, V8)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | -------------------- |
| 1 | Should the rebuilt prompt/category data shapes be declared the current guideline's way, or kept exactly as the existing implementation declares them? | Follow the current guideline's way. | Fixed as a plan-level detail (no field or behavior change, so it doesn't surface in this spec — see `plan.md` §2/§7). |
| 2 | Should the rebuilt capability depend on the project's already-rebuilt shared cross-cutting capabilities, or on the existing (not-yet-rebuilt) ones? | Depend on the already-rebuilt shared capabilities. | Fixed as a plan-level dependency choice (see `plan.md` §2/§6); no effect on this spec's behavior. |
| 3 | Should identifier and timestamp assignment for creating/updating a prompt move inside the capability itself (an internal improvement), or stay supplied from outside as it is today? | Move inside the capability itself. | Added §1 "Alternate flow — identifier and timestamp assignment moves inside the capability" and V5; reflected in AC4 and AC6. |
| 4 | When a prompt is updated, should the returned prompt be re-read from storage after the write, or assembled from the values already known before/during the write (today's behavior)? | Keep assembling it from the values already known — do not re-read after the write. | Confirmed V2/AC6 mean "identical behavior," not a behavior change; no new V/AC needed beyond what already required identical results. |
| 5 | Should this iteration also make the rebuilt capability the one that actually handles requests (and retire the existing implementation), or only build and verify it in coexistence? | Only build and verify it in coexistence; making it live and retiring the existing implementation is a future spec's job — mirroring how the project's shared-capabilities rebuild deferred this very capability's rebuild. | Added §1 "Coexistence flow" and the "Out of scope" list; scoped V1–V8/AC1–AC9 to reachability-in-coexistence rather than end-to-end user-facing routing; removed anything implying the existing implementation stops being used. |
