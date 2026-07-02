# Spec-Driven Development (SDD)

Authoritative guide for project flow.

## Core rule

Spec is the source of truth; code exists to satisfy it. Decide **what** and
**why** before **how**, write it down, then implement test-first. "Done"
means every acceptance criterion has a passing test.

## Two areas, two agents, one-way gate

```
PLAN (docs only)                  gate   IMPLEMENT (code only)
planner agent                      │     implementer agent
story → spec.md → plan.md        human   red → green → refactor
        → tasks.md              approval        → verify
steps 1–4                          │     steps 5–8
```

- No production code in PLAN. No new scope in IMPLEMENT.
- The gate opens only when all three artifacts are **READY FOR REVIEW**
  and a human has explicitly approved them.
- If implementation reveals a gap, the implementer **stops the affected
  task**, records it as a deviation, and the feature returns to PLAN.
  The implementer never patches the spec or plan itself.

## Agents

Both are Claude Code subagents in `.claude/agents/`. Each re-reads the five
project docs (`spec-driven.md`, `architecture.md`, `coding-style.md`,
`tests.md`, `database.md`) at the start of every run; those docs override
the agent prompts on conflict.

| Agent | Owns | Model | Tools | May write |
|---|---|---|---|---|
| `planner` | PLAN, steps 1–4 | opus | Read, Grep, Glob, Write | only `specs/NNN-<slug>/` |
| `implementer` | IMPLEMENT, steps 5–8 | sonnet | Read, Grep, Glob, Write, Edit, Bash | src/, tests/, migrations per plan |

**Invocation:**

```
Use the planner subagent on "<feature story>".
# review artifacts, answer open questions, approve
The artifacts for specs/NNN-<slug>/ are approved.
Use the implementer subagent on specs/NNN-<slug>/.
```

The implementer refuses to run if any artifact is missing, still DRAFT, or
approval is not explicitly stated in the invocation.

## PLAN area (planner agent, steps 1–4)

Each feature lives in `specs/NNN-<slug>/` (e.g. `specs/001-prompt-crud/`).

1. **Story:** raw intent in 1-2 sentences ("As a user, I want X so that
   Y"). No solutions. Recorded at the top of spec.md.
2. **spec.md:** behavior, fields, validation rules, error responses, and
   acceptance criteria as testable Given/When/Then statements. **No tech**
   (no Express, Prisma, Zod, status codes, or file names; errors in domain
   language).
3. **plan.md:** map spec to architecture (bounded context, entity, port,
   use cases, routes, Zod schemas, persistence adapter). This is the
   *how*. Includes assumptions/dependencies/risks, edge cases, and a
   **traceability table** (every spec item → plan element).
4. **tasks.md:** ordered, test-first checklist. Each task is **one
   red→green step**: the exact test (Red), the minimal change (Green),
   and the spec criteria it covers. Ordered dependency-first (domain →
   use case → adapters → routes → wiring); no task depends on a later
   one; migration tasks precede the code needing the schema. Every
   acceptance criterion maps to at least one task.

**Statuses:** each artifact carries `DRAFT` or `READY FOR REVIEW`. The
planner may not mark READY FOR REVIEW while design-changing questions are
open; it lists them under Open questions instead. The planner never writes
production code, tests, or migrations.

## IMPLEMENT area (implementer agent, steps 5–8)

Work `tasks.md` strictly top to bottom; never skip, reorder, or merge
tasks. Names from plan.md (entities, ports, use cases, routes, schemas)
are used verbatim. Per task:

5. **Red:** write the failing test the task describes (per `tests.md`),
   run it, confirm it fails for the expected reason. A test that passes
   immediately is a defect: stop and record a deviation.
6. **Green:** minimum code to pass it, in the layer plan.md assigns.
   Reuse existing patterns before inventing new ones. Minimal diffs only.
7. **Refactor:** clean up per `coding-style.md`, keep tests green, stay
   inside the task's scope. Tick the task checkbox (`- [x]`).
8. **Verify** (after the full list): every `spec.md` criterion has a
   passing test, and `npm test` / `lint` / `typecheck` are clean. Never
   weaken or delete a test to get to green.

Forced assumptions get a `// TODO(spec):` comment at the exact location.
The implementer finishes by returning a **completion report**: tasks done,
major decisions, TODOs, deviations, per-criterion PASS/FAIL with test
names, and test results. The human reviews it before raising a PR.

Testing mechanics: `tests.md`.

## Step boundaries

| Step | Agent | Input | Output | Touches | Do NOT |
|---|---|---|---|---|---|
| 1 Story | planner | a need | story note | spec.md (top) | propose a solution |
| 2 Specify | planner | story | spec.md | spec doc | mention tech, files, frameworks |
| 3 Plan | planner | spec.md | plan.md | plan doc | write production code |
| 4 Tasks | planner | plan.md | tasks.md | tasks doc | bundle many behaviors per task |
| — Gate | human | 3 artifacts | approval | nothing | approve with open questions |
| 5-7 Red/Green/Refactor | implementer | tasks.md | code + tests | src/, tests | add scope not in spec.md |
| 8 Verify | implementer | spec + suite | green build + report | nothing new | call it done with criteria untested |

## Conventions

- Feature folders `specs/NNN-<slug>/` each contain `spec.md`, `plan.md`,
  `tasks.md`.
- Agent definitions live in `.claude/agents/planner.md` and
  `.claude/agents/implementer.md`, checked into version control.
- Traceability chain: story → spec → plan → tasks → tests → code. Any
  break in the chain is a defect.