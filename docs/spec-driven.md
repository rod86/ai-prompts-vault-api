# Spec-Driven Development (SDD)

Authoritative guide for project flow. The [constitution](../specs/memory/constitution.md) governs *principles*; this governs *flow*.
**Stack:** Node + TypeScript REST API (Express, Zod, Prisma).

## Core rule

Spec is the source of truth; code exists to satisfy it. Decide **what** and **why** before **how**, write it down, then implement test-first. "Done" means every acceptance criterion has a passing test.

## Two areas (one-way gate)

```
PLAN (docs only)                       IMPLEMENT (code only)
story → spec.md → plan.md → tasks.md │ red → green → refactor → verify
```

- No production code in PLAN. No new scope in IMPLEMENT.
- If implementation reveals a gap, stop and return to PLAN to update the spec.

## PLAN area

Each feature lives in `specs/NNN-<slug>/` (e.g. `specs/001-prompt-crud/`).

1. **Story:** raw intent in 1-2 sentences ("As a user, I want X so that Y"). No solutions.
2. **spec.md:** behavior, fields, validation rules, error responses, and acceptance criteria as testable statements. No tech (no Express, Prisma, or file names). Template: `templates/spec-template.md`.
3. **plan.md:** map spec to architecture (bounded context, entity, port, use cases, routes, Zod schemas, persistence adapter). This is the *how*. Template: `templates/plan-template.md`.
4. **tasks.md:** ordered, test-first checklist. Each task is one red→green step. Template: `templates/tasks-template.md`.

## IMPLEMENT area

Work `tasks.md` top to bottom. Per task:

5. **Red:** write the failing test the task describes.
6. **Green:** minimum code to pass it.
7. **Refactor:** clean up per `coding-style.md`, keep tests green.
8. **Verify** (after the full list): every `spec.md` criterion has a passing test, and `npm test` / `lint` / `typecheck` are clean. See [Definition of Done](../specs/memory/constitution.md#8-definition-of-done).

Testing mechanics: `tests.md`.

## Step boundaries

| Step | Input | Output | Touches | Do NOT |
|---|---|---|---|---|
| 1 Story | a need | story note | spec.md (top) | propose a solution |
| 2 Specify | story | spec.md | spec doc | mention tech, files, frameworks |
| 3 Plan | spec.md | plan.md | plan doc | write production code |
| 4 Tasks | plan.md | tasks.md | tasks doc | bundle many behaviors per task |
| 5-7 Red/Green/Refactor | tasks.md | code + tests | src/, tests | add scope not in spec.md |
| 8 Verify | spec + suite | green build | nothing new | call it done with criteria untested |

## Conventions

- Feature folders `specs/NNN-<slug>/` each contain `spec.md`, `plan.md`, `tasks.md`.
- Templates live in `docs/templates/`.