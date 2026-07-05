---
name: spec-planner
description: The spec-driven PLAN workflow (steps 1–4) — the interview loop and how to author spec.md, plan.md, and tasks.md. Use when planning a feature before any code is written.
---

# Spec-Driven Development — PLAN workflow (steps 1–4)

The PLAN area of the project's spec-driven workflow, owned by the `planner`
agent. This skill covers the _workflow_; the artifact templates are hardcoded
in `.claude/agents/planner.md` (the single source of truth for their structure).

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

- No production code in PLAN.
- The gate opens only when `spec.md`'s **`Status`** is **READY TO IMPLEMENT**
  and a human has explicitly approved the artifacts.
- If implementation later reveals a gap, the feature returns to PLAN; the
  implementer never patches the spec or plan itself.

Each feature lives in `specs/NNN-<slug>/` (e.g. `specs/001-prompt-crud/`).

## Interview loop (clarification before authoring)

Subagents cannot prompt the user directly, so the planner runs in two passes:

- **Pass 1:** explore the codebase; if design-changing questions exist
  (anything that alters behavior, fields, validation, errors, architecture
  mapping, or task order), write **no artifacts** and return an
  `INTERVIEW REQUIRED` block: one decision per question, with options, a
  recommended default, and the impact if wrong.
- **Main session:** asks the user each question **one at a time** via
  AskUserQuestion, never batched, never answered on the user's behalf, then
  re-invokes the planner with the full Q&A list.
- **Pass 2:** the planner authors all three artifacts with answers baked in,
  logging every Q&A in the spec's Decisions log. New design-changing questions
  discovered mid-authoring send it back to pass 1.

Artifacts therefore never contain open questions: `spec.md` is written as
`Status: DRAFT` while authoring and only moves to `READY TO IMPLEMENT` once
all three artifacts are complete. Trivial choices (internal naming, private
helpers) are decided silently and logged as assumptions in plan.md.

## Steps

1. **Story:** raw intent in 1-2 sentences ("As a user, I want X so that Y").
   No solutions. Recorded at the top of spec.md.
2. **spec.md:** behavior, fields, validation rules (V#), error responses (E#),
   acceptance criteria (AC#) as testable Given/When/Then statements, and the
   Decisions log from the interview. **No tech** (no Express, Database ORM,
   Validation, status codes, or file names; errors in domain language).
3. **plan.md:** map spec to architecture (bounded context, entities, ports,
   use cases, routes mapping E# to status codes, Validation schemas tracing to
   V#, persistence adapter with migrations per the `database-modeling` skill).
   This is the
   _how_. Includes assumptions/dependencies/risks, edge cases, and a
   **traceability table** (every spec item → plan element).
4. **tasks.md:** ordered, test-first checklist. Each task is **one red→green
   step**: the exact test (Red), the minimal change (Green), and the IDs it
   covers (AC#/V#/E#). Ordered dependency-first (domain → use case → adapters →
   routes → wiring); no task depends on a later one; migration tasks precede
   the code needing the schema. Ends with a **coverage check table**: every
   AC# mapped to at least one task.

The planner never writes production code, tests, or migrations.

## Step boundaries (PLAN)

| Step        | Agent           | Input       | Output     | Touches       | Do NOT                           |
| ----------- | --------------- | ----------- | ---------- | ------------- | -------------------------------- |
| 1 Story     | planner         | a need      | story note | spec.md (top) | propose a solution               |
| — Interview | planner ↔ human | ambiguity   | Q&A list   | nothing       | guess on design; batch questions |
| 2 Specify   | planner         | story + Q&A | spec.md    | spec doc      | mention tech, files, frameworks  |
| 3 Plan      | planner         | spec.md     | plan.md    | plan doc      | write production code            |
| 4 Tasks     | planner         | plan.md     | tasks.md   | tasks doc     | bundle many behaviors per task   |
| — Gate      | human           | 3 artifacts | approval   | nothing       | approve incomplete coverage      |

## Conventions

- Feature folders `specs/NNN-<slug>/` each contain `spec.md`, `plan.md`,
  `tasks.md`. Only `spec.md` carries a `Status` field, one of `DRAFT` →
  `READY TO IMPLEMENT` → `IMPLEMENTED`; the planner sets it to
  `READY TO IMPLEMENT` as its last step. `plan.md`/`tasks.md` never have a
  `Status` field.
- Artifact templates are hardcoded in `.claude/agents/planner.md`; the
  artifact structure reference in `.claude/agents/implementer.md` must stay in
  sync with it.
- ID scheme: V# (validation rules), E# (errors), AC# (acceptance criteria),
  T# (tasks). The chain story → spec → plan → tasks → tests → code must be
  traceable end to end; any break is a defect.
