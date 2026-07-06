---
name: open-threads
description: Unresolved/deferred design questions flagged for future features to pick up
metadata:
  type: project
---

- No shared/global error-handling middleware exists, and no scaffolding
  toward one (see [[middleware-infra]] — a user correction removed that
  entirely). Centralizing domain-error-to-status mapping (e.g.
  `PromptNotFoundError` → 404, `CategoryNotFoundError` → 400, both still
  handled per-handler) remains fully open/unstarted — treat it as a fresh
  design question, not a "continue a deferred plan," if a future feature
  raises it. Getting more likely to matter now that two different domain
  errors map to two different status codes by convention alone; a delete
  feature (007) added a third handler with its own local try/catch, all
  still un-centralized.
- No delete feature for `PromptCategory` yet (only `Prompt` delete exists,
  `specs/007-delete-prompt/`) — deleting a category that still has prompts
  referencing it would hit the `prompt_category_id` foreign key; this is a
  fresh design question (cascade? restrict? not yet decided anywhere).

**Why:** flags decisions intentionally deferred rather than forgotten, so a
future planning pass treats them as live open questions instead of assuming
prior art settled them.
**How to apply:** re-check whether still open (grep for the relevant
file/pattern) before assuming either still applies — remove an entry once a
future spec resolves it.
