# Spec: List categories
Status: READY FOR REVIEW
Story: As a user, I want to see all categories so that I can browse and filter prompts by topic.

## 1. Behavior

**Main flow:** The user requests the list of categories. The system returns
every category currently available, each identified by its id and labeled
by its name, ordered alphabetically by name (ascending) so the list is easy
to scan when browsing or filtering.

**Alternate flow:** If no categories are currently available, the user
receives an empty list. This is a normal, successful outcome, not an error.

**Initial data:** The system ships with a starter set of eleven categories,
inserted by a data migration (see plan.md §7):

1. Writing & Content
2. Marketing & Social Media
3. Coding & Development
4. Data & Analytics
5. Business & Finance
6. Learning & Research
7. Productivity
8. Design & UX
9. Career & Job Search
10. Customer Support
11. Legal & Compliance

The empty state (alternate flow above) must still be supported: the starter
set is initial data, not a guaranteed invariant.

## 2. Fields

| Field | Meaning | Domain type | Required | Default |
|---|---|---|---|---|
| id | Unique identifier of the category | text | true | — |
| name | Human-readable label of the category, used for browsing and filtering prompts | text | true | — |

## 3. Validation rules

This operation accepts no user-supplied input (no filters, no parameters).
No validation rules apply. Validation rules for category data itself (e.g.
name constraints) will be introduced with a future feature that lets users
create or edit categories.

## 4. Error responses

This operation has no user-triggerable error conditions: requesting the
list of categories always succeeds, returning either the full list or an
empty list (see AC3). No error responses are defined for this operation.

## 5. Acceptance criteria

- **AC1:** Given multiple categories exist, When the user requests the list
  of categories, Then the response includes every category, each with its
  id and name.
- **AC2:** Given multiple categories exist, When the user requests the list
  of categories, Then the categories are ordered alphabetically by name,
  ascending.
- **AC3:** Given no categories exist, When the user requests the list of
  categories, Then the response is an empty list, not an error.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
|---|---|---|---|
| 1 | Where should the category concept live architecturally? | Categories are grouped together with prompt-related concepts rather than treated as a fully separate area. | No effect on user-facing behavior; recorded for the design mapping in plan.md. |
| 2 | Should categories come with a starter set of data, or start out empty? | Start with an initial starter set of eleven categories (listed in §1, Initial data), inserted by a data migration, while the system must still correctly support the empty state. | Added the "Initial data" list to §1; confirms AC3 (empty list) is a genuinely supported state, not merely a startup default; the migration itself is specified in plan.md §7. |
| 3 | In what order should the categories be listed? | Alphabetically by name, ascending. | Added AC2, requiring alphabetical ordering by name. |
