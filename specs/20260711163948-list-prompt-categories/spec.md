# Spec: List prompt categories
Status: READY TO IMPLEMENT
Story: As an API client, I want to list all prompt categories so that I can browse and filter prompts by category.

## 1. Behavior
Main flow:
1. The client requests the list of prompt categories.
2. The system returns every category currently available, each identified by its id and labelled by its name.
3. The categories are ordered alphabetically by name (ascending) so the list is easy to scan when browsing or filtering.

Alternate flow:
- When no categories exist, the system returns an empty list (this is a normal result, not an error).

Out of scope: pagination, filtering, or searching the categories; authentication/authorization; creating, updating, or deleting categories.

## 2. Fields
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier of a category | text | Yes | — |
| name | Human-readable label of a category | text | Yes | — |

<!-- No new fields are introduced; these are the existing attributes of a category, listed to define the shape returned. -->

## 3. Validation rules
None — the request carries no input to validate.

## 4. Error responses
None — listing always succeeds; an empty catalogue yields an empty list, which is not an error.

## 5. Acceptance criteria
- AC1: Given one or more categories exist, When the client requests the list of categories, Then the system returns all of them, each with its id and name, ordered alphabetically by name ascending.
- AC2: Given no categories exist, When the client requests the list of categories, Then the system returns an empty list.

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | When two categories share the same name, and how do upper/lower case affect ordering? | Order by name case-insensitively, then by id as a stable tie-breaker. | AC1 ordering is case-insensitive and deterministic. |
| 2 | Is an empty catalogue an error or a valid result? | Valid result — return an empty list. | Adds AC2; §4 has no error responses. |
| 3 | Does this feature include filtering, pagination, or auth? | No — listing every category is the whole feature. | Recorded in §1 "Out of scope". |
