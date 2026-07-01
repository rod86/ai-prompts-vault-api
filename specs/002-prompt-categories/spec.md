# Spec — Prompt Categories Listing

> **Plan area, step 2.** WHAT and WHY only. No tech, no file names, no
> frameworks. See [docs/spec-driven.md](../../docs/spec-driven.md).

## User story

As a client of the prompts API, I want to retrieve the full list of prompt
categories so that I can present the available categories to users and let them
browse or filter prompts by category.

## Summary

The API exposes a read-only listing of every prompt category. A category is a
named grouping that a prompt can belong to. Each category has a stable
identifier and a human-readable name. Clients call the categories collection and
receive all categories in a single response. The listing is unfiltered and
unpaginated for now.

## Behavior

- Requesting the categories collection returns every existing category.
- Each returned category exposes its identifier and its name, and nothing else.
- When no categories exist, the response is an empty collection (not an error).
- The operation is read-only: it never creates, changes, or deletes anything.
- Ordering is stable and deterministic (by name, ascending), so repeated calls
  return categories in the same order.

## Fields

Each item in the returned collection:

| Field | Type   | Required | Rules / constraints                                  |
| ----- | ------ | -------- | ---------------------------------------------------- |
| id    | string | Yes      | Unique, stable identifier of the category (UUID).    |
| name  | string | Yes      | Non-empty human-readable category name.              |

## Validation rules

- The request takes no input parameters; there is nothing to validate on input.

## Error responses

| Condition                             | Response                    |
| ------------------------------------- | --------------------------- |
| The category store cannot be read     | 500 Internal Server Error   |

(There is no not-found case: an empty store yields a `200` with an empty list.)

## Acceptance criteria (testable)

- [ ] Given categories exist, when the categories collection is requested, then
      the response status is `200` and the body is a list of all categories.
- [ ] Given the response body, then each item contains exactly `id` and `name`.
- [ ] Given no categories exist, when the collection is requested, then the
      response status is `200` and the body is an empty list.
- [ ] Given multiple categories exist, when the collection is requested twice,
      then both responses list the categories in the same (name-ascending) order.

## Out of scope

- Creating, updating, or deleting categories.
- Filtering, searching, pagination, or sorting controls via query parameters.
- Returning the prompts that belong to a category.
- Authentication / authorization of the endpoint.
- Any database migration or schema-definition work.

Categories are a concept owned by the prompts area; this feature only reads them.
