---
description: Create or update spec-driven-development PLANNING artifacts (spec.md, plan.md, tasks.md) — runs the PLANNING stage, stops at the approval gate, writes no code.
argument-hint: <new feature description | update instruction for an existing spec>
model: opus
---

Request: $ARGUMENTS

When `$ARGUMENTS` is empty or brief, the **preceding conversation in this session
is the feature definition** — synthesize the story and design from what was
already discussed rather than making the user restate everything. Any argument
given refines or overrides that discussion.

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
- **IMPLEMENTED** → the `spec-driven-development` skill's immutability rule is
  unconditional and has **no override here**: an `IMPLEMENTED` folder's `spec.md`,
  `plan.md`, and `tasks.md` are never edited again, even on my direct instruction to
  do so. Refuse the UPDATE, tell me the target is `IMPLEMENTED`, and switch to
  **CREATE mode** instead — author a brand-new `specs/<YMDHMS>-<slug>/` folder for
  the requested change, cross-referencing the original spec for context.

In every case you remain inside PLANNING: no production code, tests, or migrations.

## Steps 1–4 (the PLANNING stage)

Run the stage exactly as the skill defines it. In UPDATE mode, read the existing
artifacts first and apply these steps as revisions that preserve full
traceability rather than starting from a blank page.

1. **Story** — restate the feature as a single "As a `<user>`, I want `<X>` so that
   `<Y>`" user story (no solutions). This becomes the `Story:` line of `spec.md`.
   When the argument doesn't fully specify the feature, derive the story from the
   prior discussion in this session, then confirm that one-line story with me via
   the interview step. In UPDATE mode, keep the existing story unless the request
   changes it.
2. **Explore** — read the relevant code before planning; never plan against code you
   have not read; prefer reusing existing functions/patterns and cite their paths.
3. **Interview (live)** — ask me every design-changing question **one at a time** via
   AskUserQuestion. Never batch and never answer on my behalf. Log each Q&A in
   `spec.md` §6 (append to the existing decisions log in UPDATE mode; never rewrite
   history). Decide only trivial choices silently, logging them as assumptions.
4. **Author** — write/rewrite `spec.md` → `plan.md` → `tasks.md` in order using the
   skill's templates, keeping full traceability (story → spec → plan → tasks) and
   re-checking the coverage table. Set the new/updated `spec.md`'s `Status:` to
   `READY TO IMPLEMENT` as the final action (CREATE, and UPDATE of a drafting/READY
   spec, both land here — an IMPLEMENTED target was already redirected to CREATE
   mode above, so this step never touches an IMPLEMENTED folder).

**Do not touch git.** Not `add`/`commit`/`push`, not a branch, not even a read-only
`status`/`diff`/`log` — leave `spec.md`/`plan.md`/`tasks.md` as plain uncommitted files.
Committing this work is `/spec-implement`'s job, not this command's (see CLAUDE.md
Golden Rule 5).

Then **stop at the gate**: report the folder path and the three file paths, whether
you created or updated them, the number of decisions logged (and how many are new in
UPDATE mode), and any dependency changes. State that the artifacts await my explicit
approval before implementation. Do not start coding.
