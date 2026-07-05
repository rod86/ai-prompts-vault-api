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

**Why this matters:** know what already exists before proposing a new
context/entity/route; a "new" request is often an extension of 001-005.
**How to apply:** skim this list first, then read the actual current source
under the referenced paths — this file only orients you, it is not a
substitute for reading code.
