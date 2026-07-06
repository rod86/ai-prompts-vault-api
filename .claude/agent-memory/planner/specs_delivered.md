---
name: specs-delivered
description: Status and one-line summary of every spec delivered so far in ai-prompts-vault-api
metadata:
  type: project
---

- `specs/001-list-categories/` — `GET /categories`, alphabetical, seeded with 11
  starter categories. All tasks done.
- `specs/002-list-prompts/` — `GET /prompts` (+ optional `?category=` filter),
  most-recent-first, prompts carry a nested category reference.
- `specs/003-get-prompt/` — `GET /prompts/:id`, 404 via local per-handler
  try/catch (no shared error middleware yet at that point).
- `specs/004-request-validation-middleware/` — cross-cutting `src/middleware/`.
  See [[middleware-infra]] for the final (post-reorganization) shape — its own
  spec/plan artifacts are stale on file paths and field names, verify against
  actual code.
- `specs/005-create-prompt/` — `POST /prompts`, first write/create operation.
  See [[write-operation-conventions]].
- `specs/006-update-prompt/` — `PUT /prompts/:id`, full-replace semantics
  (every field required every call, no partial patch); `description` is
  required-as-a-key but nullable-in-value, distinct from create's plain
  `.optional()`. First feature with two coexisting not-found-shaped errors
  (`PromptNotFoundError` 404 vs `CategoryNotFoundError` 400) and an explicit
  precedence rule between them. See [[write-operation-conventions]].
- `specs/007-delete-prompt/` — `DELETE /prompts/:id`, hard delete, `204 No
  Content` with **no** response body on success — by explicit user decision
  overriding the story's "confirmation" wording. First delete/removal
  feature; resolves the "no delete feature yet" open thread. See
  [[write-operation-conventions]].

**Why this matters:** know what already exists before proposing a new
context/entity/route; a "new" request is often an extension of 001-007.
**How to apply:** skim this list first, then read the actual current source
under the referenced paths — this file only orients you, it is not a
substitute for reading code.
