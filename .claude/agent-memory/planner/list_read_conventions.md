---
name: list-read-conventions
description: Recurring design conventions for list/read (GET) features in ai-prompts-vault-api
metadata:
  type: feedback
---

Apply these defaults to any future list/read feature unless the user says
otherwise:

- **Empty list is a normal success** — HTTP 200 with `[]`, never an error.
  Call this out explicitly as an acceptance criterion.
- **Deterministic ordering** — every list defines an explicit order plus an
  `id` secondary tie-break so results are stable (categories: `lower(name)`
  then id; prompts: `createdAt` desc then id).
- **Adapter owns ordering/joining/filtering**, documented in the port
  contract; the use case just passes the result through, never re-sorts or
  re-filters.
- **Opaque filter values on reads** — no format validation on a list's filter
  input; a non-matching value yields `[]`, not an error (002 Decision #4).
  Fold "no such category" and "category with no prompts" into a single
  empty-result AC. Contrast [[write-operation-conventions]], which
  deliberately reverses this for writes.
- **Optional fields** → `T | undefined`, shown as absent (not `null`) in the
  response (002 AC6).
- **`id` is always application-provided** (UUID), never DB-generated.
- **Seed data vs empty state** — categories ship 11 starter rows via a
  hand-authored data migration, yet the empty state must still be supported
  and tested; prompts ship no seed data. Starter data is not a guaranteed
  invariant.
- **Zod at the HTTP boundary even with no V#** — if an endpoint takes any
  user input, plan a structural Zod schema (see [[middleware-infra]] for the
  current file location), even when the spec defines no validation rules
  (guards against unexpected shapes).

**Why:** these were each explicit decisions in 001/002/003 that the user
confirmed; repeating them as fresh questions would be redundant.
**How to apply:** default silently to these for a new read feature; only ask
if the feature genuinely needs to diverge (e.g. a write, per
[[write-operation-conventions]]).
