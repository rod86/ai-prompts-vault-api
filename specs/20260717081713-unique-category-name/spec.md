# Spec: Unique category names
Status: READY TO IMPLEMENT
Story: As a maintainer of the prompt catalogue, I want each category to have a unique name so that the catalogue never contains two categories with the same name.

## 1. Behavior
Main flow:
1. The category catalogue guarantees that no two categories share the same name.
2. Names are compared **without regard to letter casing**, so "Productivity" and
   "productivity" are treated as the same name.

Alternate flows:
- When something attempts to store a category whose name matches an existing
  category's name (ignoring letter casing), the attempt is rejected, the existing
  category is left unchanged, and no second category is created.
- Storing a category whose name differs from every existing name (ignoring letter
  casing) succeeds as before.

Existing state:
- Every category currently in the catalogue already has a distinct name (even when
  casing is ignored), so introducing this guarantee removes or alters none of them.

Out of scope: any client-facing way to create, rename, or delete categories (none
exists today); trimming or any normalization of names beyond letter-casing;
uniqueness of any attribute other than `name`.

## 2. Fields
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier of a category (unchanged) | text | Yes | — |
| name | Human-readable label of a category — now unique across the catalogue, ignoring letter casing | text | Yes | — |

<!-- No new fields; `name` gains a uniqueness rule. -->

## 3. Validation rules
- **V1**: A category's `name` must not match the `name` of any other category when
  compared ignoring letter casing. "Invalid" means a second category carrying an
  already-used name (in any casing) is not permitted to exist.

## 4. Error responses
- **E1 (duplicate category name)**: When an attempt is made to store a category whose
  name equals an existing category's name (ignoring letter casing), the store rejects
  the attempt so the duplicate is never persisted. No client-facing endpoint performs
  such writes today, so this rejection surfaces only at the storage boundary; it is
  not exposed as an API response.

## 5. Acceptance criteria
- **AC1**: Given a category named "Productivity" exists, When storing another category
  whose name is "Productivity", Then the store rejects it and no second category is
  created. (covers V1, E1)
- **AC2**: Given a category named "Productivity" exists, When storing another category
  whose name is "productivity" (same letters, different casing), Then the store rejects
  it and no second category is created. (covers V1, E1 — case-insensitivity)
- **AC3**: Given a category named "Productivity" exists, When storing a category whose
  name is a genuinely different name, Then it is stored successfully. (covers V1 — the
  positive path)

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should the category-name uniqueness be case-insensitive or case-sensitive? | Case-insensitive — "Productivity" and "productivity" are the same name. | V1 and AC2 compare names ignoring casing; E1 triggers on case variants. |
| 2 | Should this be covered by a new automated test? | No — skip it; it's only a database change. | AC1–AC3 are proven by applying the declarative unique-index migration cleanly (against the seed data) rather than by a new test — the constraint is enforced by the database, not by application code. No client-facing behavior exists to exercise. |
| 3 | How is the constraint verified in the absence of a test? | Manually: after applying the migration, run two inserts against `prompt_categories` — `Category1` then `category1` — the first must succeed and the second must be rejected (proving case-insensitive uniqueness, AC2/AC1); delete both rows afterward. | AC2 is empirically demonstrated by the rejected case-variant insert, not only by inspecting the emitted index; the check leaves no residue (both ids removed). |
