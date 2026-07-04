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
npm db:migrate            # Run database migrations
npm run dev               # start the API (http://localhost:3000)
```

## Scripts

- `npm run dev`: Run the API with hot reload (tsx)
- `npm run build`: Compile TypeScript to `dist/`
- `npm start`: Run the compiled app
- `npm test`: Run the test suite (Vitest)
- `npm run lint`: ESLint (incl. hexagonal boundaries)
- `npm run typecheck`: Type-check without emitting
- `npm run db:migrate`: Apply database migrations

## How we work — Spec-Driven Development

The workflow is split across two Claude Code skills under `.claude/skills/`,
each used by one agent:

| Agent | Owns | Model | Skill |
|---|---|---|---|
| `planner` | PLAN, steps 1–4 | opus | `spec-planner` |
| `implementer` | IMPLEMENT, steps 5–8 | sonnet | `spec-implementation` |

**Invocation:**

```
Use the planner subagent on "<feature story>".
# if the planner returns INTERVIEW REQUIRED: answer each question,
# re-invoke the planner with the full Q&A list
# review artifacts, then approve:
The artifacts for specs/NNN-<slug>/ are approved.
Use the implementer subagent on specs/NNN-<slug>/.
```

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
  architecture.md    # the layers, in detail
  coding-style.md    # generic coding rules + what's not allowed
  testing.md         # how tests are organized
  database.md        # how database is managed   
  templates/         # spec / plan / tasks templates
tests/               # app tests
```

## Documentation

- **Spec-Driven Development** — the workflow, split across the `spec-planner`
  (PLAN) and `spec-implementation` (IMPLEMENT) skills in `.claude/skills/`.
- **[Architecture](./docs/architecture.md)** — layers & dependency rules.
- **[Coding style](./docs/coding-style.md)** — conventions & what's not allowed.
- **[Testing](./docs/testing.md)** — testing strategy.
- **[Database](./docs/database.md) - Database and migrations
