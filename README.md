<p align="center">
  <img width="100" height="100" alt="ai-prompt-vault-icon" src="https://github.com/user-attachments/assets/1e75cd54-8f85-4ab4-9979-1bd0aa20932a" />
</p>

# AI Prompt Vault API

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**, **Domain Driven Design**, and **TDD**.

<p align="center">
  <img height="30" alt="claude-badge" src="https://github.com/user-attachments/assets/ab5deb13-e3a0-4574-825b-989112284e90" />
</p>

## Tech stack

- Node v24.16.0
- TypeScript v5
- Express v5
- PostgreSQL v18.4 + Drizzle ORM
- Vitest + Supertest

## Requirements

- Docker and Docker compose
- [Node Version Manager](https://github.com/nvm-sh/nvm)

## Installation

- Download [https://github.com/rod86/ai-prompts-vault-api](https://github.com/rod86/ai-prompts-vault-api).
- Install and switch to node version.
```shell
nvm install & nvm use
```
- Install dependencies.
```shell
npm i
```
- Start docker services.
```shell
docker compose up -d
```
- Run all database migrations.
```shell
npm db:migrate
```

- Start the API
```shell
npm run dev
```

## Scripts

- `npm run dev`: Run the API with hot reload (tsx)
- `npm run build`: Compile TypeScript to `dist/`
- `npm start`: Run the compiled app
- `npm test`: Run all tests
- `npm run lint`: ESLint (incl. hexagonal boundaries)
- `npm run typecheck`: Type-check without emitting
- `npm run db:migrate`: Apply database migrations

## Project Structure

```
src/
  logic/                # legacy business logic
  modules/              # business logic (follows conventions from skill `domain-driven-design`)
  handlers/             # Route handlers
  middleware/           # Global and routes middleware
  schemas/              # validateRequestMiddleware validation schemas
  config.ts             # Config with loaded env vars + hardcoded params
  app.ts                # HTTP app: middleware + routes (no listen)
  index.ts              # app server bootstrap
tests/                  
  lib/                  # Shared test helpers (database, mocks, builders, sample responses,...)
  unit/                 # Unit tests
  integration/          # Integration 
specs/                  # Spec driven development specs
drizzle/                # Drizzle kit migrations
```

## Testing

The project follows **Test-Driven Development (TDD)**: a failing test is written before
the code that makes it pass. Tests run on [Vitest](https://vitest.dev/) with
[Supertest](https://github.com/ladjs/supertest) for HTTP.

There are two kinds of tests:

- **Unit tests** (`tests/unit/`) — fast, isolated tests for business logic (use cases,
  domain rules). External dependencies such as the database are replaced with mocks, so
  these need no services running.
- **Integration tests** (`tests/integration/`) — exercise the real wiring: routes,
  handlers, and database repositories against an actual PostgreSQL instance. Shared
  helpers live in `tests/lib/` (database access, builders, sample data).

### Running tests

- Integration tests need a running database with the schema applied. 

```shell
docker compose up -d     # start PostgreSQL
npm run db:migrate       # apply the latest migrations
```

- Run the tests.

```shell
npm test                                   # run the whole suite once (the CI command)
npx vitest                                 # watch mode — re-runs on file changes (TDD loop)
npx vitest run tests/unit/.../X.test.ts    # run a single test file
npx vitest run -t 'returns 404'            # run tests whose name matches a string
```

## Git workflow

The repository uses three kinds of branches:

- **`main`** — always matches what is running in **production**. It is never worked on
  directly; you only merge into it through a release.
- **`development`** — the shared **integration** branch where finished features come
  together. Every new piece of work starts from here, and every pull request is merged
  back into here.
- **`spec/<slug>`** — a **feature** branch for building a single spec. `<slug>` is the
  name of the spec being implemented (for example, `spec/archive-prompt`). This is where
  day-to-day changes happen.

A typical feature goes through these steps:

1. Update your local `development` branch: `git checkout development && git pull`.
2. Create a feature branch from it: `git checkout -b spec/<slug>`.
3. Implement the spec, committing as you go (one commit per completed task).
4. Push the branch and open a **pull request into `development`**.
5. Once reviewed and merged, the feature is part of the next release into `main`.

> Rule of thumb: never commit to `main` or `development` directly — always work on a
> `spec/<slug>` branch and open a pull request into `development`.

## Claude Code

**CLAUDE.md**: Detailed project info (structure, workflows, ...)

### Skills

- **clean-code**:  SOLID and Clean Code principles
- **coding-style**: TypeScript coding style guidelines
- **database-schema-design**: Engine-agnostic relational schema-design conventions
- **spec-driven-development**: Spec-driven (SDD) workflow (agnostic to project)
- **domain-driven-design**:  Domain-Driven Design guidelines for TypeScript
- **testing-practices**: Testing conventions for TypeScript

### Commands

**/spec-plan**: Command to generate a new or update a specs plan.

``/spec-plan let users archive a prompt``

**/spec-implement**: Command to implement a specs plan.

``/spec-implement 20260708173845-archive-prompt``

## Spec-Driven Development Flow

**Spec-Driven Development (SDD)** means we decide *what* to build and *why* — and write it
down — **before** writing any code. The written spec is the source of truth; the code
exists to satisfy it. This keeps features well-understood, reviewable, and traceable from
the original idea all the way down to the tests that prove it works.

If you have never used SDD, the key idea is simple: **no code without an approved spec.**

### The two stages

Every feature moves through two stages, separated by a human approval gate:

1. **Planning** — figure out the behavior and design, on paper. No production code is
   written yet. This stage produces three documents (see below) and ends when a person
   reviews and approves them.
2. **Implementation** — build the feature test-first (write a failing test, then the code
   that makes it pass), following the approved documents exactly. No new scope is added
   here; if something is missing, we go back to planning.

```
Planning (docs only)  ──approval──▶  Implementation (code, test-first)
```

### Where specs live

Each feature gets its own folder under `specs/`, named with a timestamp and a short slug,
e.g. `specs/20260708173845-archive-prompt/`. Inside are three files:

- **`spec.md`** — *what* the feature does and *why*: the user story, rules, and acceptance
  criteria. No technical detail. It also carries a `Status` (see below).
- **`plan.md`** — *how* it will be built: the design that satisfies the spec.
- **`tasks.md`** — an ordered, test-first checklist that turns the plan into small steps.

A feature is only "done" when every acceptance criterion in `spec.md` has a passing test.

> Specs with different naming (e. g. 009-login) were created using a different spec-driven development flow.
  See old flow here: [https://github.com/rod86/ai-prompts-vault-api/tree/spec-driven-dev-v1](https://github.com/rod86/ai-prompts-vault-api/tree/spec-driven-dev-v1)

### Status lifecycle

`spec.md` tracks progress with a `Status` field:

- *(blank)* — still being written during planning.
- **READY TO IMPLEMENT** — planning is finished and approved; implementation can begin.
- **IMPLEMENTED** — the feature is built and tested. The spec is now a frozen historical
  record; any later change starts a brand-new spec folder rather than editing this one.

### Helper commands (Claude Code)

The workflow is supported by two commands: `/spec-plan` runs the planning stage and stops
at the approval gate, and `/spec-implement` takes an approved spec and builds it
test-first. See `CLAUDE.md` and the `spec-driven-development` skill for the full details.

