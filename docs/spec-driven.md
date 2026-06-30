# Spec-Driven Development (SDD)

The methodology this project follows. This is the authoritative SDD guide
referenced by the [constitution](../specs/memory/constitution.md §3).

---

## Why SDD

The **spec is the source of truth**; code exists to satisfy it. We decide *what*
and *why* before *how*, write it down, and only then implement — test-first. This
keeps intent reviewable, prevents scope creep, and makes "done" objective: every
acceptance criterion has a passing test.

---

## The two areas (hard boundary)

```
PLAN area  ──────────────────────────────▶  IMPLEMENT area
user story → spec.md → plan.md → tasks.md ─┊─ red → green → refactor → verify
       (documents only, no code)               (code only, no new scope)
```

The `─┊─` is a one-way gate. You do **not** write production code in the Plan
area, and you do **not** invent new scope in the Implement area. If implementation
reveals a gap, stop and go back to the Plan area to update the spec.

---

## Plan area — steps

Each feature gets a folder: `specs/NNN-<slug>/` (e.g. `specs/001-prompt-crud/`).

### 1. Capture the user story

Record the raw intent in one or two sentences: *"As a user, I want to … so
that …."* No solutions yet.

### 2. Specify → `spec.md`

Turn the story into a feature spec using
[`templates/spec-template.md`](../specs/templates/spec-template.md):

- Behavior, fields, and rules.
- Validation rules and error responses.
- **Acceptance criteria as testable statements.**

**No tech detail** — no Express, no Prisma, no file names.

### 3. Plan → `plan.md`

Map the spec onto the architecture using
[`templates/plan-template.md`](../specs/templates/plan-template.md): which
bounded context, entity, port, use cases, routes, Zod schemas, and (later)
persistence adapter. This is the "dump the plan" step — *how*, not *what*.

### 4. Tasks → `tasks.md`

Break the plan into an ordered, **test-first** checklist using
[`templates/tasks-template.md`](../specs/templates/tasks-template.md). Each task
is a single red→green step: *write the failing test, then make it pass.*

---

## Implement area — steps

Work the `tasks.md` list top to bottom. For each task:

5. **Red** — write the failing test the task describes.
6. **Green** — write the minimum code to pass it.
7. **Refactor** — clean up against [`coding-style.md`](./coding-style.md), keep
   tests green.
8. **Verify** — once the list is complete, confirm every acceptance criterion in
   `spec.md` has a passing test, and `npm test` / `lint` / `typecheck` are clean
   → the [Definition of Done](../specs/memory/constitution.md#8-definition-of-done).

See [`tests.md`](./tests.md) for the testing mechanics.

---

## Step boundaries

| Step              | Input              | Output artifact     | Touches                     | Do **NOT**                                  |
| ----------------- | ------------------ | ------------------- | --------------------------- | ------------------------------------------- |
| 1. User story     | a need             | story note          | `spec.md` (top)             | propose a solution                          |
| 2. Specify        | user story         | `spec.md`           | the spec doc                | mention tech, files, or frameworks          |
| 3. Plan           | `spec.md`          | `plan.md`           | the plan doc                | write production code                       |
| 4. Tasks          | `plan.md`          | `tasks.md`          | the tasks doc               | bundle many behaviors into one task         |
| 5–7. Red/Green/Refactor | `tasks.md`   | code + tests        | `src/`, test files          | add scope not in `spec.md`                  |
| 8. Verify         | spec + suite       | green build         | nothing new                 | call it done with criteria untested         |

---

## Conventions

- Feature folders: `specs/NNN-<slug>/` with `spec.md`, `plan.md`, `tasks.md`.
- Templates live in [`specs/templates/`](../specs/templates).
- The project-wide rules live in the
  [constitution](../specs/memory/constitution.md); this guide governs the *flow*,
  the constitution governs the *principles*.
