---
name: spec-implementation
description: The spec-driven IMPLEMENT workflow (steps 5–8) — gate check, the red→green→refactor loop, and verify. Use when implementing an approved specs/NNN-<slug>/ plan.
---

# Spec-Driven Development — IMPLEMENT workflow (steps 5–8)

The IMPLEMENT area of the project's spec-driven workflow, owned by the
`implementer` agent. Testing mechanics live in the `testing` skill.

## Core rule

Spec is the source of truth; code exists to satisfy it. Decide **what** and
**why** before **how**, write it down, then implement test-first. "Done"
means every acceptance criterion has a passing test.

## Two areas, one-way gate

```
PLAN (docs only)                    gate   IMPLEMENT (code only)
planner agent                        │     implementer agent
story → interview loop →           human   red → green → refactor
spec.md → plan.md → tasks.md     approval          → verify
steps 1–4                            │     steps 5–8
```

- No new scope in IMPLEMENT.
- The gate opens only when `spec.md`'s **`Status`** is **READY TO IMPLEMENT**
  and a human has explicitly approved the artifacts.
- If implementation reveals a gap, the implementer **stops the affected task**,
  records it as a deviation, and the feature returns to PLAN. The implementer
  never patches the spec or plan itself.

## Gate check (before any code)

- `spec.md` exists with `Status: READY TO IMPLEMENT`. A `DRAFT` status means
  planning isn't finished — do not implement.
- The coverage check table in `tasks.md` is complete (every AC# mapped).
- Human approval is explicitly stated in the invocation.

Then work `tasks.md` strictly top to bottom; never skip, reorder, or merge
tasks. Names from plan.md (entities, ports, use cases, routes, schemas) are
used verbatim.

## Steps

Per task:

5. **Red:** write the failing test the task describes (per the `testing` skill), run
   it, confirm it fails for the expected reason. A test that passes immediately
   is a defect: stop and record a deviation.
6. **Green:** minimum code to pass it, in the layer plan.md assigns. Reuse
   existing patterns before inventing new ones. Minimal diffs only.
7. **Refactor:** clean up per the `coding-style` skill, keep tests green, stay inside
   the task's scope. Tick the task checkbox (`- [x]`).
8. **Verify** (after the full list): every AC# in `spec.md` has a passing test,
   and `npm test` / `lint` / `typecheck` are clean. Never weaken or delete a
   test to get to green.

Forced assumptions get a `// TODO(spec):` comment at the exact location. The
implementer finishes by returning a **completion report**: tasks done, major
decisions, TODOs, deviations, per-AC# PASS/FAIL with test names, and test
results. The human reviews it before raising a PR.

## Step boundaries (IMPLEMENT)

| Step                   | Agent       | Input        | Output               | Touches     | Do NOT                              |
| ---------------------- | ----------- | ------------ | -------------------- | ----------- | ----------------------------------- |
| — Gate                 | human       | 3 artifacts  | approval             | nothing     | approve incomplete coverage         |
| 5-7 Red/Green/Refactor | implementer | tasks.md     | code + tests         | src/, tests | add scope not in spec.md            |
| 8 Verify               | implementer | spec + suite | green build + report | nothing new | call it done with criteria untested |

## Conventions

- Feature folders `specs/NNN-<slug>/` each contain `spec.md`, `plan.md`,
  `tasks.md`. Only `spec.md` carries a `Status` field (`DRAFT` → `READY TO
  IMPLEMENT` → `IMPLEMENTED`); the implementer flips it to `IMPLEMENTED`
  once verify passes.
- The artifact structure reference in `.claude/agents/implementer.md` must stay
  in sync with the templates hardcoded in `.claude/agents/planner.md`.
- ID scheme: V# (validation rules), E# (errors), AC# (acceptance criteria),
  T# (tasks). The chain story → spec → plan → tasks → tests → code must be
  traceable end to end; any break is a defect.
