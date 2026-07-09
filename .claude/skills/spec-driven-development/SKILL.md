---
name: spec-driven-development
description: The project's spec-driven development (SDD) workflow, split into a PLANNING stage (author spec.md, plan.md, tasks.md) and an IMPLEMENTATION stage (test-first code). Use before writing any code for a new feature, endpoint, or behavior change — even when the user just says "let's build/add X" without mentioning specs or planning; this project requires an approved spec before implementation.
---

# Spec-Driven Development (SDD)

The project's end-to-end workflow for turning a feature idea into working, tested
code. It runs **inline** in the main session — there is no separate planner/implementer
subagent and no two-pass handoff; you clarify with the user directly via AskUserQuestion
as you go.

## Core rule

Spec is the source of truth; code exists to satisfy it. Decide **what** and **why**
before **how**, write it down, get it approved, then implement test-first. "Done" means
every acceptance criterion is proven — by a passing test, or, for an AC covered solely by
a logic-less file (a composition root, a pure re-export — see `testing-practices`), by a
clean type-check instead.

## Two stages, one-way gate

```
PLANNING (docs only)              gate            IMPLEMENTATION (code only)
story → interview →              human            red → green → refactor
spec.md → plan.md → tasks.md   approval                   → verify
steps 1–4                          │              steps 5–8
```

- No production code in PLANNING. No new scope in IMPLEMENTATION.
- The gate opens only when `spec.md`'s **`Status`** is **READY TO IMPLEMENT** and a
  human has explicitly approved the artifacts.
- If implementation later reveals a gap, the feature returns to PLANNING; you never
  patch the spec or plan silently from inside implementation — stop, surface it, and
  re-plan.

## Feature folder convention

Each feature lives in its own folder:

```
specs/<YMDHMS>-<slug>/
  spec.md     # WHAT — behavior, no tech. Carries the Status field.
  plan.md     # HOW  — maps spec to a design.
  tasks.md    # ordered, test-first checklist.
```

- `<YMDHMS>` is a UTC timestamp in `YYYYMMDDHHMMSS` (14 digits). Generate it with:

  ```
  date -u +%Y%m%d%H%M%S
  ```

  `<slug>` is a short kebab-case name, e.g. `specs/20260708143022-prompt-crud/`.
- Timestamps make every new story a new folder automatically — no "next free number"
  bookkeeping and no collisions. A story that extends or revises an existing feature
  still gets its **own new folder**; never reopen an implemented spec.
- Only `spec.md` carries a `Status` field, with two values: `READY TO IMPLEMENT` →
  `IMPLEMENTED`. It is left blank while the artifacts are being authored; the final
  author action sets it to `READY TO IMPLEMENT`. `plan.md` and `tasks.md` never have a
  `Status`.

**HARD RULE — `IMPLEMENTED` is permanent.** Once `spec.md`'s `Status` is `IMPLEMENTED`,
its folder (`spec.md`, `plan.md`, `tasks.md`) is **never edited again, by anyone, for any
reason** — not a bug found later, not a refactor, not a testing-convention change adopted
after the fact, not even an explicit user request to "just fix this one." There is no
exception clause and no human override for this one: a human can approve *new* work, but
cannot re-open old work — the folder itself is the thing that must never change. The only
correct response to new information about implemented behavior is a **new**
`specs/<YMDHMS>-<slug>/` folder through PLANNING, even when the fix is one line. If asked
to edit an `IMPLEMENTED` folder directly, refuse and propose the new-spec path instead.

## ID scheme and traceability

- `V#` validation rules, `E#` errors, `AC#` acceptance criteria, `T#` tasks.
- The chain **story → spec → plan → tasks → tests → code** must be traceable end to
  end. Any break is a defect.

## Stages

- **PLANNING (steps 1–4):** see [references/planning.md](references/planning.md) for the
  explore → live interview → author workflow and the artifact templates.
- **IMPLEMENTATION (steps 5–8):** see [references/implementation.md](references/implementation.md).
