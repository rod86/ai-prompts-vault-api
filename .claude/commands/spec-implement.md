---
description: Implement an approved spec-driven-development spec — syncs the base branch, cuts a feature branch, runs the IMPLEMENTATION stage (Red/Green/Refactor/Verify) committing per task, merges the base branch into the feature branch, and opens a PR into the base branch.
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

## Branch parameters

Resolve these **once** from CLAUDE.md → "Git branches" and use the names below
throughout; never hardcode branch names.

- **BASE_BRANCH** — the integration-role branch in CLAUDE.md (feature branches are
  cut from it; PRs target it).
- **FEATURE_BRANCH** — `<prefix>/<slug>` per CLAUDE.md, with `<slug>` = the
  resolved spec folder's slug.

## Step 0 — Resolve, gate & set up (before any code)

Run these strictly **in order**. Every guard is a **hard stop**: on failure, abort
and write no code.

1. **Clean-tree guard** — if the injected **Uncommitted changes** list is non-empty,
   **exit with an error** telling me to commit or stash and clean the current branch
   before re-running. Touch nothing.
2. **Sync the base branch** — check out **BASE_BRANCH** and `git pull` to get the
   latest changes.
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
5. **`.env` guard** — scan the resolved spec's `plan.md` (and `tasks.md`) for
   changes that require adding or updating the local **`.env`** file. If any are
   found: print the exact edit I must make (var names, values, and any
   comment/context from the plan), then **stop and wait** — ask me via
   AskUserQuestion to confirm I applied it, and do not cut the branch or write any
   code until I confirm. **Never edit `.env` yourself** at any point in the run.
   This covers only the local untracked `.env`; the tracked `.env.example` remains
   a normal implementation task you perform yourself. No `.env` changes required →
   silent no-op.
6. **Cut the feature branch** — create and switch to **FEATURE_BRANCH** for this
   spec, cut off **BASE_BRANCH**. If the branch already exists, switch to it.
7. **Database up** — run `docker compose up -d`. Integration tests hit a real
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

## Sync the base branch & open the pull request

Once the spec is `IMPLEMENTED` and committed, sync **BASE_BRANCH** into
**FEATURE_BRANCH** *before* opening the PR — so any merge conflicts surface here,
on the feature branch, not on the target branch / in the PR. In order:

1. **Push FEATURE_BRANCH** to its remote (send all committed changes up).
2. **Check out BASE_BRANCH** and `git pull` to get the latest changes.
3. **Check out FEATURE_BRANCH** and **`git merge BASE_BRANCH`**. If the merge is
   **empty** (`Already up to date` — no new commits merged), **skip steps 4–5 and
   the re-push in step 6**: the tree is byte-identical to what step 8 already
   verified, and the branch already went up in step 1 — go straight to opening
   the PR.
4. **Resolve any conflicts** within the spec's scope, then complete the merge commit.
5. **Re-run the full verification suite** after the merge — `npm test`,
   `npm run lint`, `npm run typecheck` — to prove the merge broke nothing. **Never**
   weaken, skip, or delete a test to reach green. If anything fails and it can't be
   fixed within scope, **stop as BLOCKED**: report the failure and the
   conflicted/affected files, and **do not open the PR**.
6. On green, **push FEATURE_BRANCH again** (the merge commit), then open a pull
   request **into BASE_BRANCH** with `gh pr create --base <BASE_BRANCH> …` (no
   reviewer), following repo PR conventions. Report the PR URL in the completion
   report.

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
