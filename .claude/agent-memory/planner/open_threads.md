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
  errors map to two different status codes by convention alone.
- No delete feature yet for `Prompt`/`PromptCategory` — writes so far are
  create (`specs/005-create-prompt/`) and update (`specs/006-update-prompt/`);
  a delete feature is still a fresh design question.

**Why:** flags decisions intentionally deferred rather than forgotten, so a
future planning pass treats them as live open questions instead of assuming
prior art settled them.
**How to apply:** re-check whether still open (grep for the relevant
file/pattern) before assuming either still applies — remove an entry once a
future spec resolves it.
