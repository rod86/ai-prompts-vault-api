# AI Prompt Vault API

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**,
**hexagonal architecture**, and strict **TDD**.

## Status

Foundation initialized. The runtime skeleton boots and exposes a `/health`
endpoint; feature work (Prompt CRUD) is authored next via the SDD flow.

## Tech stack

- **Runtime:** Node.js (pinned in [`.nvmrc`](./.nvmrc); engines floor >= 20) + TypeScript (`strict`)
- **HTTP:** Express
- **Validation:** Zod (at the HTTP boundary)
- **Testing:** Vitest + Supertest
- **Persistence:** in-memory adapter now — PostgreSQL + Prisma deferred

## Getting started

```bash
nvm use            # switch to the Node version in .nvmrc
npm install
npm run dev        # start the API (http://localhost:3000)
```

Then check it:

```bash
curl http://localhost:3000/health   # {"status":"ok"}
```

## Scripts

| Script              | Does                                  |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Run the API with hot reload (tsx)     |
| `npm run build`     | Compile TypeScript to `dist/`         |
| `npm start`         | Run the compiled app                  |
| `npm test`          | Run the test suite (Vitest)           |
| `npm run lint`      | ESLint (incl. hexagonal boundaries)   |
| `npm run typecheck` | Type-check without emitting           |

## How we work — Spec-Driven Development

Every feature flows through the SDD pipeline, with a hard gate between planning
and implementation:

```
PLAN area  ──────────────────────────────▶  IMPLEMENT area
user story → spec.md → plan.md → tasks.md ─┊─ red → green → refactor → verify
       (documents only, no code)               (TDD only, no new scope)
```

1. **Capture** the user story.
2. **Specify** → `spec.md` (what & why; no tech).
3. **Plan** → `plan.md` (map onto the architecture).
4. **Tasks** → `tasks.md` (ordered, test-first checklist).
5. **Implement** test-first: red → green → refactor → verify.

Start a feature by copying the templates in
[`specs/templates/`](./specs/templates) into a new `specs/NNN-<slug>/` folder.

## Project layout

```
src/
  logic/             # business logic by bounded context (layers created on demand)
    shared/          # cross-context code only
  config/env.ts      # env loading + validation
  app.ts             # Express app (middleware + routes), exported for tests
  index.ts           # composition root + server bootstrap
specs/
  memory/constitution.md   # the governing document — start here
  templates/               # spec / plan / tasks templates
docs/
  spec-driven.md     # the SDD methodology (step boundaries)
  architecture.md    # the layers, in detail
  coding-style.md    # generic coding rules + what's not allowed
  tests.md           # how tests are organized
tests/integration/   # HTTP integration tests (Supertest)
```

## Documentation

- **[Constitution](./specs/memory/constitution.md)** — non-negotiable principles (read first).
- **[Spec-Driven Development](./docs/spec-driven.md)** — the workflow.
- **[Architecture](./docs/architecture.md)** — layers & dependency rules.
- **[Coding style](./docs/coding-style.md)** — conventions & what's not allowed.
- **[Tests](./docs/tests.md)** — testing strategy.
