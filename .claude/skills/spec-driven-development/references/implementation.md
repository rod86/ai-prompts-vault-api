# IMPLEMENTATION stage (steps 5–8)

The IMPLEMENTATION stage turns an **approved** `specs/<YMDHMS>-<slug>/` plan into working,
tested, lint-clean code. You run it **inline** in the main session, working `tasks.md`
strictly top to bottom, one task at a time, test-first. You add **no new scope**: the
spec, plan, and tasks are fixed inputs. If they turn out to be wrong or incomplete, you
**stop and re-plan** — you never patch them from inside implementation.

Read the [SKILL.md](../SKILL.md) first for the core rule, the two-stage gate, the folder
convention, and the ID scheme — this file assumes them.

## Gate check (before any code)

Do not write a line of production code until all of these hold:

- `specs/<YMDHMS>-<slug>/spec.md` exists with **`Status: READY TO IMPLEMENT`**. A blank
  status means the artifacts are still being authored — planning isn't finished, so stop.
- The **Coverage check** table in `tasks.md` is complete: every `AC#` maps to at least one
  task.
- A human has **explicitly approved** the artifacts for implementation. Approval to plan
  is not approval to implement — if it isn't clearly given, ask.

Once the gate is open, work `tasks.md` top to bottom. Never skip, reorder, or merge tasks;
the order is dependency-first by construction. Use the names from `plan.md` (entities,
ports, use cases, routes, schemas) **verbatim** — implementation introduces no new
vocabulary.

## The four steps (per task)

Repeat steps 5–7 for each task `T#` in order. Run step 8 once, after the whole list.

### 5. Red
Write **only** the failing test the task's `Red:` line describes — one test per task. Run
it and confirm it **fails for the expected reason** (assertion or missing symbol, not a
typo or setup error). A test that passes the moment you write it is a defect: stop, and
treat it as a deviation (the behavior already exists, or the task is mis-specified).

### 6. Green
Write the **minimum** code to make that test pass, in the layer `tasks.md` assigns via its
`Type:` tag (`migration` | `domain` | `application` | `infrastructure` | custom) and the
element `plan.md` names. Reuse existing functions, patterns, and utilities before inventing
new ones. Minimal diffs only — no speculative abstraction, no unrelated cleanup, nothing
outside the task's `Covers:` IDs. Migration tasks run before the code that needs the schema
(they are already ordered that way).

### 7. Refactor
With the test green, clean up **within the task's scope** — follow the [clean-code](../../clean-code/SKILL.md)
and [coding-style](../../coding-style/SKILL.md) skills (and [domain-driven-design](../../domain-driven-design/SKILL.md)
/ [database-schema-design](../../database-schema-design/SKILL.md) for the layer you're in).
Keep every test green. Then tick the task's checkbox in `tasks.md`: `- [ ]` → `- [x]`.

### 8. Verify (once, after the full list)
- Every `AC#` in `spec.md` §5 has at least one passing test.
- The full suite, lint, and typecheck are all clean (e.g. `npm test`, `npm run lint`,
  `npm run typecheck` — use the project's actual scripts).
- **Never** weaken, skip, or delete a test to reach green; that hides the gap instead of
  closing it.

As the **last action**, once verify passes, set `spec.md`'s `Status` to **`IMPLEMENTED`**.
That value is terminal: the spec is now a frozen historical record. Any later change —
even a fix or extension — opens a **new** `specs/<YMDHMS>-<slug>/` folder via PLANNING;
you never reopen or edit an `IMPLEMENTED` spec.

## When the plan is wrong (BLOCKED)

If a task can't be executed as written — the plan has a gap, two tasks contradict, an
assumption fails against real code, or a task would require scope not in the spec — **stop
that task**. Do not improvise a redesign and do not silently edit the artifacts. Report a
**deviation**: the task ID, what's missing or wrong, and the smallest planning change that
would unblock it. The feature returns to PLANNING; implementation resumes only after the
artifacts are re-approved.

For a genuinely unavoidable local assumption that does *not* change spec'd behavior, leave
a `// TODO(spec):` comment at the exact location and record it in the completion report —
don't let it disappear.

## Completion report

Finish by reporting, for the human to review before a PR is raised:

- Tasks completed (and any left blocked).
- Major implementation decisions and every `TODO(spec):` left in the code.
- Deviations raised, if any.
- **Per-`AC#` PASS/FAIL**, each with the name of the test that proves it.
- The suite / lint / typecheck results.

## Step boundaries

| Step                   | Input        | Output               | Touches       | Do NOT                              |
| ---------------------- | ------------ | -------------------- | ------------- | ----------------------------------- |
| — Gate                 | 3 artifacts  | approval             | nothing       | implement without `READY TO IMPLEMENT` + approval |
| 5–7 Red/Green/Refactor | tasks.md     | code + tests         | src/, tests   | add scope not in spec.md; reorder tasks |
| 8 Verify               | spec + suite | green build + report | spec.md Status | call it done with any `AC#` untested |

## Hard rules

- **No new scope.** The spec, plan, and tasks are fixed. New behavior means new PLANNING,
  not a bigger diff here.
- **One task, one test, in order.** Never skip, reorder, or merge tasks; never write two
  tests for one task (split the task in PLANNING instead).
- **Red before green, always.** No production code without a test that failed first for
  the right reason.
- **Never weaken the suite to pass.** Deleting, skipping, or loosening a test to reach
  green is a defect, not progress.
- **Stop on gaps.** A wrong or missing plan → BLOCKED + deviation → re-plan. Never patch
  `spec.md`/`plan.md`/`tasks.md` from inside implementation.
- **Traceability holds end to end:** story → spec → plan → tasks → tests → code. Anything
  untraceable is a defect.
