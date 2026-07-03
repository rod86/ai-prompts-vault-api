# Spec-Driven Development (SDD)

Authoritative guide for project flow.
**Stack:** Node + TypeScript REST API (Express, Zod, Prisma).

## Core rule

Spec is the source of truth; code exists to satisfy it. Decide **what** and
**why** before **how**, write it down, then implement test-first. "Done"
means every acceptance criterion has a passing test.

## Two areas, two agents, one-way gate

```
PLAN (docs only)                    gate   IMPLEMENT (code only)
planner agent                        │     implementer agent
story → interview loop →           human   red → green → refactor
spec.md → plan.md → tasks.md     approval          → verify
steps 1–4                            │     steps 5–8
```

- No production code in PLAN. No new scope in IMPLEMENT.
- The gate opens only when all three artifacts exist as **READY FOR
  REVIEW** and a human has explicitly approved them.
- If implementation reveals a gap, the implementer **stops the affected
  task**, records it as a deviation, and the feature returns to PLAN.
  The implementer never patches the spec or plan itself.

## Agents

Both are Claude Code subagents in `.claude/agents/`, checked into version
control. Each re-reads the five project docs (`spec-driven.md`,
`architecture.md`, `coding-style.md`, `testing.md`, `database.md`) at the
start of every run; those docs override the agent prompts on conflict.
**Artifact templates are hardcoded in the planner agent prompt**, which is
the single source of truth for their structure; there are no template
files.

| Agent | Owns | Model | Tools | May write |
|---|---|---|---|---|
| `planner` | PLAN, steps 1–4 | opus | Read, Grep, Glob, Write | only `specs/NNN-<slug>/` |
| `implementer` | IMPLEMENT, steps 5–8 | sonnet | Read, Grep, Glob, Write, Edit, Bash | src/, tests/, migrations per plan |

**Invocation:**

```
Use the planner subagent on "<feature story>".
# if the planner returns INTERVIEW REQUIRED: answer each question,
# re-invoke the planner with the full Q&A list
# review artifacts, then approve:
The artifacts for specs/NNN-<slug>/ are approved.
Use the implementer subagent on specs/NNN-<slug>/.
```

## PLAN area (planner agent, steps 1–4)

Each feature lives in `specs/NNN-<slug>/` (e.g. `specs/001-prompt-crud/`).

### Interview loop (clarification before authoring)

Subagents cannot prompt the user directly, so the planner runs in two
passes:

- **Pass 1:** explore the codebase; if design-changing questions exist
  (anything that alters behavior, fields, validation, errors,
  architecture mapping, or task order), write **no artifacts** and return
  an `INTERVIEW REQUIRED` block: one decision per question, with options,
  a recommended default, and the impact if wrong.
- **Main session:** asks the user each question **one at a time** via
  AskUserQuestion, never batched, never answered on the user's behalf,
  then re-invokes the planner with the full Q&A list.
- **Pass 2:** the planner authors all three artifacts with answers baked
  in, logging every Q&A in the spec's Decisions log. New design-changing
  questions discovered mid-authoring send it back to pass 1.

Artifacts therefore never contain open questions and are only ever
written as READY FOR REVIEW. Trivial choices (internal naming, private
helpers) are decided silently and logged as assumptions in plan.md.

### Steps

1. **Story:** raw intent in 1-2 sentences ("As a user, I want X so that
   Y"). No solutions. Recorded at the top of spec.md.
2. **spec.md:** behavior, fields, validation rules (V#), error responses
   (E#), acceptance criteria (AC#) as testable Given/When/Then
   statements, and the Decisions log from the interview. **No tech** (no
   Express, Prisma, Zod, status codes, or file names; errors in domain
   language).
3. **plan.md:** map spec to architecture (bounded context, entities,
   ports, use cases, routes mapping E# to status codes, Zod schemas
   tracing to V#, persistence adapter with migrations per `database.md`).
   This is the *how*. Includes assumptions/dependencies/risks, edge
   cases, and a **traceability table** (every spec item → plan element).
4. **tasks.md:** ordered, test-first checklist. Each task is **one
   red→green step**: the exact test (Red), the minimal change (Green),
   and the IDs it covers (AC#/V#/E#). Ordered dependency-first (domain →
   use case → adapters → routes → wiring); no task depends on a later
   one; migration tasks precede the code needing the schema. Ends with a
   **coverage check table**: every AC# mapped to at least one task.

The planner never writes production code, tests, or migrations.

## IMPLEMENT area (implementer agent, steps 5–8)

Gate check before any code: all three artifacts READY FOR REVIEW, the
coverage check table complete, and human approval explicitly stated in
the invocation. Then work `tasks.md` strictly top to bottom; never skip,
reorder, or merge tasks. Names from plan.md (entities, ports, use cases,
routes, schemas) are used verbatim. Per task:

5. **Red:** write the failing test the task describes (per `testing.md`),
   run it, confirm it fails for the expected reason. A test that passes
   immediately is a defect: stop and record a deviation.
6. **Green:** minimum code to pass it, in the layer plan.md assigns.
   Reuse existing patterns before inventing new ones. Minimal diffs only.
7. **Refactor:** clean up per `coding-style.md`, keep tests green, stay
   inside the task's scope. Tick the task checkbox (`- [x]`).
8. **Verify** (after the full list): every AC# in `spec.md` has a passing
   test, and `npm test` / `lint` / `typecheck` are clean. Never weaken or
   delete a test to get to green.

Forced assumptions get a `// TODO(spec):` comment at the exact location.
The implementer finishes by returning a **completion report**: tasks done,
major decisions, TODOs, deviations, per-AC# PASS/FAIL with test names,
and test results. The human reviews it before raising a PR.

Testing mechanics: `testing.md`.

## Step boundaries

| Step | Agent | Input | Output | Touches | Do NOT |
|---|---|---|---|---|---|
| 1 Story | planner | a need | story note | spec.md (top) | propose a solution |
| — Interview | planner ↔ human | ambiguity | Q&A list | nothing | guess on design; batch questions |
| 2 Specify | planner | story + Q&A | spec.md | spec doc | mention tech, files, frameworks |
| 3 Plan | planner | spec.md | plan.md | plan doc | write production code |
| 4 Tasks | planner | plan.md | tasks.md | tasks doc | bundle many behaviors per task |
| — Gate | human | 3 artifacts | approval | nothing | approve incomplete coverage |
| 5-7 Red/Green/Refactor | implementer | tasks.md | code + tests | src/, tests | add scope not in spec.md |
| 8 Verify | implementer | spec + suite | green build + report | nothing new | call it done with criteria untested |

## Conventions

- Feature folders `specs/NNN-<slug>/` each contain `spec.md`, `plan.md`,
  `tasks.md`, all with `Status: READY FOR REVIEW` when the planner
  finishes.
- Artifact templates are hardcoded in `.claude/agents/planner.md`; the
  artifact structure reference in `.claude/agents/implementer.md` must
  stay in sync with it.
- ID scheme: V# (validation rules), E# (errors), AC# (acceptance
  criteria), T# (tasks). The chain story → spec → plan → tasks → tests →
  code must be traceable end to end; any break is a defect.