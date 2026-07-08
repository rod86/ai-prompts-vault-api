---
description: Implement an approved spec-driven-development spec — syncs the integration branch, cuts a feature branch, runs the IMPLEMENTATION stage (Red/Green/Refactor/Verify) committing per task, and opens a PR into the integration branch.
argument-hint: <spec folder name or slug to implement (optional; omit to auto-pick the lone READY spec)>
model: sonnet
allowed-tools: Bash(grep:*), Bash(git:*), Bash(docker compose:*), Bash(gh pr create:*)
---

Request: $ARGUMENTS

Invoke the `spec-driven-development` skill and execute **only its IMPLEMENTATION
stage (steps 5–8)** against an already-approved spec folder. Work `tasks.md`
strictly top to bottom, one task at a time, **test-first**. You add **no new
scope**: `spec.md`, `plan.md`, and `tasks.md` are fixed inputs. If they turn out
to be wrong or incomplete, **stop and re-plan** (BLOCKED) — never patch the
artifacts from inside implementation.

## Repo state (injected)

- Current git branch: !`git branch --show-current`
- Uncommitted changes: !`git status --porcelain`
- Spec statuses:
!`grep -H "^Status:" specs/*/spec.md 2>/dev/null || echo "(no spec.md files found)"`
- Docker services:
!`docker compose ps 2>/dev/null || echo "(docker compose not running)"`

Use the injected data above instead of rediscovering it. The **Spec statuses** list
resolves Step 0 and the gate; **Uncommitted changes** and **Docker services** drive
the guards below.

**Branch names come from CLAUDE.md → "Git branches".** This command refers to the
branch **roles** — *production*, *integration*, and *feature* (`<prefix>/<slug>`) —
and you resolve each to its actual name from that table. Do not hardcode branch names.

## Step 0 — Resolve, gate & set up (before any code)

Run these strictly **in order**. Every guard is a **hard stop**: on failure, abort
and write no code.

1. **Clean-tree guard** — if the injected **Uncommitted changes** list is non-empty,
   **exit with an error** telling me to commit or stash and clean the current branch
   before re-running. Touch nothing.
2. **Sync the integration branch** — check out the **integration branch** (CLAUDE.md
   → Git branches) and `git pull` to get the latest changes. Never work off the
   **production branch** — it mirrors production, never touch it.
3. **Resolve the target spec folder** — determine which `specs/<YMDHMS>-<slug>/`
   folder to implement:
   - **Argument given** — resolve `$ARGUMENTS`, accepting either the full folder name
     (`20260708173845-archive-prompt`) or just the slug (`archive-prompt`). If a bare
     slug matches more than one folder, stop and ask me which via AskUserQuestion.
   - **No argument** — from the injected **Spec statuses**, take the spec whose status
     is `READY TO IMPLEMENT`: exactly one → use it; more than one → list them and ask
     me via AskUserQuestion; none → stop and tell me nothing is ready (finish a spec
     with `/spec-plan` first).
4. **Gate check** — running this command **is my explicit approval**, so do not
   additionally pause. But hard-verify and refuse (write no code) if either fails:
   - The resolved `spec.md`'s `Status` must be **`READY TO IMPLEMENT`**. **Blank** →
     planning isn't finished, stop (run `/spec-plan`). **`IMPLEMENTED`** → frozen and
     immutable, refuse and tell me to open a **new** spec folder via `/spec-plan`.
   - The **Coverage check** table in `tasks.md` must be complete — every `AC#` maps to
     at least one task. A missing row means the plan is incomplete: stop, re-plan.
5. **Cut the feature branch** — create and switch to the **feature branch** for this
   spec, cut off the integration branch. Its name follows the feature-branch pattern
   in CLAUDE.md → Git branches, with `<slug>` = the resolved folder's slug. If the
   branch already exists, switch to it.
6. **Database up** — run `docker compose up -d`. Integration tests hit a real
   Postgres. If Postgres **cannot be initialized / brought up** (compose fails or the
   DB never becomes reachable), **finish with an error** and stop — never implement
   against a dead database.

## Steps 5–8 (the IMPLEMENTATION stage)

Run the stage exactly as the skill defines it in
`references/implementation.md` — do not restate or reinvent the mechanics here.
Use the names from `plan.md` (entities, ports, use cases, routes, schemas)
**verbatim**; implementation introduces no new vocabulary. Per task `T#`, in order:

5. **Red** — write **only** the one failing test the task's `Red:` line describes and
   confirm it fails for the **expected reason** (assertion or missing symbol, not a
   typo/setup error). A test that passes on write is a defect — stop and treat it as a
   deviation.
6. **Green** — write the **minimum** code to pass it, in the layer the task's `Type:`
   tag assigns and the element `plan.md` names. Reuse existing functions, patterns, and
   utilities before inventing new ones. Minimal diffs, nothing outside the task's
   `Covers:` IDs.
7. **Refactor & commit** — with the test green, clean up **within the task's scope**
   (follow the `clean-code`, `coding-style`, `domain-driven-design`, and
   `database-schema-design` skills for the layer you're in), keep every test green,
   then tick the task's checkbox in `tasks.md`: `- [ ]` → `- [x]`. **Then commit that
   task's changes** (code + test + the tasks.md tick) with a message referencing the
   task ID and spec slug, following repo commit conventions (including the
   `Co-Authored-By` trailer). **One task → one commit.**
8. **Verify (once, after the whole list)** — every `AC#` in `spec.md` §5 has at least
   one passing test, and the full suite, lint, and typecheck are clean: `npm test`,
   `npm run lint`, `npm run typecheck`. **Never** weaken, skip, or delete a test to
   reach green. Then set `spec.md`'s `Status` to **`IMPLEMENTED`** and commit that
   change.

## Open the pull request

Once the spec is `IMPLEMENTED` and committed, push the feature branch and open a pull
request **into the integration branch** (CLAUDE.md → Git branches) with
`gh pr create --base <integration-branch> …` (no reviewer), following repo PR
conventions. Report the PR URL in the completion report.

## When the plan is wrong (BLOCKED)

If a task can't be executed as written — a gap, a contradiction, an assumption that fails
against real code, or work that would require scope not in the spec — **stop that task**.
Do not improvise a redesign and do not silently edit the artifacts. Report a **deviation**:
the task ID, what's missing or wrong, and the smallest planning change that would unblock
it. The feature returns to PLANNING (`/spec-plan`); implementation resumes only after the
artifacts are re-approved. Commits already made for completed tasks stay; do **not** open a
PR. For an unavoidable local assumption that does *not* change spec'd behavior, leave a
`// TODO(spec):` at the exact location and record it in the report.

## Completion report

Finish by reporting, for me to review:

- Tasks completed (and any left blocked), with one commit per completed task.
- Major implementation decisions and every `TODO(spec):` left in the code.
- Deviations raised, if any.
- **Per-`AC#` PASS/FAIL**, each with the name of the test that proves it.
- The suite / lint / typecheck results.
- The pull request URL.
