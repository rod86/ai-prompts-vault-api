# AI Prompt Vault API

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**,
**hexagonal architecture**, and strict **TDD**.

## Tech stack

- Node v24.16.0
- TypeScript v5
- Express v5
- PostgreSQL + Drizzle ORM
- Vitest + Supertest

## Getting started

```bash
nvm use                   # switch to the Node version in .nvmrc
npm install               # Install dependencies
docker compose up -d      # Start postgres
                          # Run database migrations
npm run dev               # start the API (http://localhost:3000)
```

## Scripts

- `npm run dev`: Run the API with hot reload (tsx)
- `npm run build`: Compile TypeScript to `dist/`
- `npm start`: Run the compiled app
- `npm test`: Run the test suite (Vitest)
- `npm run lint`: ESLint (incl. hexagonal boundaries)
- `npm run typecheck`: Type-check without emitting

## How we work — Spec-Driven Development

- We create a user story and generate a spec plan using the agent `spec-task-planner`.

- Once the plan is ready, we implement the plan using the agent `spec-plan-implementer`.

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

## Project layout

```
src/                 # Project source code
specs/               # spec plans created by spec planner subagent 
docs/                
  spec-driven.md     # the SDD methodology (step boundaries)
  architecture.md    # the layers, in detail
  coding-style.md    # generic coding rules + what's not allowed
  tests.md           # how tests are organized
  database.md        # how database is managed   
  templates/         # spec / plan / tasks templates
tests/               # app tests
```

## Documentation

- **[Spec-Driven Development](./docs/spec-driven.md)** — the workflow.
- **[Architecture](./docs/architecture.md)** — layers & dependency rules.
- **[Coding style](./docs/coding-style.md)** — conventions & what's not allowed.
- **[Tests](./docs/tests.md)** — testing strategy.
