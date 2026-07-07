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
- Resolved (corrected mid-flight): 009-login's first-drafted plan.md had
  `auth` call into `user` via a `VerifyUserCredentialsUseCase` exposed from
  `user/services.ts`, with `compare()` added to `user`'s own
  `PasswordHasherInterface`. The user explicitly rejected this — see
  [[auth_and_new_context_conventions]] for the corrected, final shape:
  `user` reverts to its `008` shape except that `PasswordHasherInterface`/
  `BcryptPasswordHasher` move to `shared` (the one genuinely-shared piece);
  `auth` never calls `user` at all — it owns a duplicated direct read of the
  `users` table and its own combined token-issue/password-verify port. Treat
  "auth calls into user's services.ts" as a **rejected** pattern, not
  precedent, for any future cross-context read.
- 008 also left the DB-level unique-index-violation-to-409 translation
  unhandled (see [[auth_and_new_context_conventions]] Risk 1): a concurrent
  double-registration race that slips past the use case's `findByEmail`
  check would surface as an unmapped 500, not a 409. Still unresolved as of
  009. Revisit if this is observed in practice.
- New from 009-login: the generic invalid-credentials response has a known,
  accepted timing-attack gap (unknown-email path skips `bcrypt.compare()`
  entirely, wrong-password path calls it) — see
  [[auth_and_new_context_conventions]] Risk. Still open; a future security
  pass could add a dummy-hash compare on the unknown-email path.
- New from 009-login: `JWT_SECRET` (and env vars generally) has no fail-fast
  validation in `config.ts` — an unset secret silently signs tokens with an
  empty string rather than crashing at startup. No "required env" mechanism
  exists anywhere in this codebase yet; still open if ever prioritized.

**Why:** flags decisions intentionally deferred rather than forgotten, so a
future planning pass treats them as live open questions instead of assuming
prior art settled them.
**How to apply:** re-check whether still open (grep for the relevant
file/pattern) before assuming either still applies — remove an entry once a
future spec resolves it.
