---
description: Create or update spec-driven-development PLANNING artifacts (spec.md, plan.md, tasks.md) — runs the PLANNING stage, stops at the approval gate, writes no code.
argument-hint: <new feature description | update instruction for an existing spec>
model: opus
---

Request: $ARGUMENTS

Invoke the `spec-driven-development` skill and execute **only its PLANNING stage
(steps 1–4)** for the request above. This command **plans only**: it NEVER writes
production code, tests, or migrations, and never crosses into the IMPLEMENTATION
stage. Your only writes are the three artifacts (`spec.md`, `plan.md`, `tasks.md`)
inside a single `specs/<YMDHMS>-<slug>/` folder.

## Step 0 — Decide the mode: CREATE or UPDATE

First determine whether the request describes a **new feature** or an
**instruction to update an existing spec**:

- **CREATE** — the request is a new feature/behavior with no existing spec folder.
  Author a brand-new `specs/<YMDHMS>-<slug>/` folder (generate the timestamp with
  `date -u +%Y%m%d%H%M%S`).
- **UPDATE** — the request refers to or asks to change an existing spec (by folder
  name, slug, feature name, or an explicit "update/revise the … spec"). Work **in
  place** on that existing folder; do not open a new one. If the target spec is
  ambiguous (the request could match more than one folder, or none), stop and ask
  me which spec folder to update via AskUserQuestion before doing anything else.

### UPDATE mode — status gate

Read the target `spec.md`'s `Status:` field and act on it:

- **Blank (still drafting)** or **READY TO IMPLEMENT** → update the artifacts
  freely in place.
- **IMPLEMENTED** → the `spec-driven-development` skill normally treats an
  IMPLEMENTED spec as frozen. For this command that rule is overridden: when I
  explicitly instruct you to update an IMPLEMENTED spec, **do not refuse and do
  not redirect me to a new folder** — proceed to update the artifacts in place.
  (This changes only the planning documents; because this command never touches
  code, the already-shipped implementation is unaffected.)

In every case you remain inside PLANNING: no production code, tests, or migrations.

## Steps 1–4 (the PLANNING stage)

Run the stage exactly as the skill defines it. In UPDATE mode, read the existing
artifacts first and apply these steps as revisions that preserve full
traceability rather than starting from a blank page.

1. **Story** — restate the feature as a single "As a `<user>`, I want `<X>` so that
   `<Y>`" user story (no solutions). This becomes the `Story:` line of `spec.md`.
   In UPDATE mode, keep the existing story unless the request changes it.
2. **Explore** — read the relevant code before planning; never plan against code you
   have not read; prefer reusing existing functions/patterns and cite their paths.
3. **Interview (live)** — ask me every design-changing question **one at a time** via
   AskUserQuestion. Never batch and never answer on my behalf. Log each Q&A in
   `spec.md` §6 (append to the existing decisions log in UPDATE mode; never rewrite
   history). Decide only trivial choices silently, logging them as assumptions.
4. **Author** — write/rewrite `spec.md` → `plan.md` → `tasks.md` in order using the
   skill's templates, keeping full traceability (story → spec → plan → tasks) and
   re-checking the coverage table. Set `spec.md` `Status:` as the final action:
   - CREATE, or UPDATE of a drafting/READY spec → `READY TO IMPLEMENT`.
   - UPDATE of an IMPLEMENTED spec → leave `Status:` as `IMPLEMENTED` (the code
     already shipped; this command does not re-open implementation), unless the
     revision adds genuinely unimplemented behavior — in that case tell me so and
     recommend a new spec folder rather than silently downgrading the status.

Then **stop at the gate**: report the folder path and the three file paths, whether
you created or updated them, the number of decisions logged (and how many are new in
UPDATE mode), and any dependency changes. State that the artifacts await my explicit
approval before implementation. Do not start coding.
