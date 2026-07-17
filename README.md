<p align="center">
  <img width="100" height="100" alt="ai-prompt-vault-icon" src="https://github.com/user-attachments/assets/1e75cd54-8f85-4ab4-9979-1bd0aa20932a" />
</p>

# AI Prompt Vault API

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**, **Domain Driven Design**, and **TDD**.

<p align="center">
  <img height="30" alt="claude-badge" src="https://github.com/user-attachments/assets/ab5deb13-e3a0-4574-825b-989112284e90" />
</p>

- [Tech stack](#tech-stack)
- [API Documentation](#api-documentation)
- [Requirements](#requirements)
- [Installation](#installation)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Git workflow](#git-workflow)
- [Claude Code](#claude-code)
- [Spec-Driven Development Flow](#spec-driven-development-flow)

## Tech stack

- Node v24.16.0
- TypeScript v5
- Express v5
- PostgreSQL v18.4 + Drizzle ORM
- Vitest + Supertest

## API Documentation

Once the API is running, interactive documentation is available at
[`/docs`](http://localhost:3000/docs) — a browsable reference generated from the same
request/response schemas the API validates against, with a built-in **"try it"**
playground for every endpoint.

- Protected endpoints need a token: call `POST /authenticate`, then paste the returned
  token into the page's authorization control.
- The underlying OpenAPI 3.1 description is served as JSON at
  [`/openapi.json`](http://localhost:3000/openapi.json) — point Postman (or any other API
  client) at that address, or use the page's download control, to import it directly.
- Requests to `/docs`, its files, and `/openapi.json` don't count against the request
  rate limit.

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
npm run db:migrate
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
- `npm run test:unit`: Run unit tests
- `npm run test:integration`: Run integration tests
- `npm run lint`: ESLint (incl. hexagonal boundaries)
- `npm run typecheck`: Type-check without emitting
- `npm run db:migrate`: Apply database migrations

## Project Structure

```
src/
  modules/<context>/       # business logic (bounded contexts + shared context)
    domain/                # entities, domain errors, repository interfaces
    application/           # use cases
    infrastructure/        # Adapters (drizzle repositories, Token Generators,...)
    services.ts            # Context services setup (DI wiring)
  handlers/<resource>/     # HTTP route handlers (auth, users, prompts, health)
  middleware/              # Express 
  docs/                    # OpenAPI document (zod-openapi) + global.ts (shared response fragments) + one paths file per resource
  errors/                  # HTTP-boundary error (e. g. ApiError)
  routes/
    <resource>/            # per-resource: router + request/response schemas (auth, users, prompts, health)
    shared/                # cross-resource field validators + error envelope schemas
  config/
    config.ts              # env vars + fixed params (no schema)
    drizzle/               # Drizzle config (per-context schema files + index.ts barrel with types and config)
  types/                   # Additional TypeScript types declarations (e.g. custom req typing)
  app.ts                   # HTTP app: middleware + routes (no listen)
  index.ts                 # server bootstrap + graceful shutdown
tests/
  lib/                     # shared helpers: DB helpers, model factories
  unit/                    
  integration/             
public/                    # static files served as-is — API docs page + service icon
specs/                     # spec-driven development specs, one folder per feature
drizzle/                   # generated SQL migrations
coverage/                  # Test coverage reports
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
npm test                               # run the whole suite once (includes coverage reports)
vitest                                 # watch mode — re-runs on file changes (TDD loop)
vitest run tests/unit/.../X.test.ts    # run a single test file
vitest run -t 'returns 404'            # run tests whose name matches a string
```

### Coverage

- The coverage treshold is **80%*.
- Coverage reports files are output in ``coverage/`` directory.
- The coverage formats are:
    - *text*: See coverage info in terminal.
    - *html*: See coverage details in browser. Open ``coverage/index.html``.
    - *json-summary*: Generates a ``coverage/coverage-summary.json`` (per-file totals).
    - *lcov*: Generates a `coverage/lcov.info` (line/branch detail).

> Formats **json-summary** and **lcov** are used by AI. When you ask AI "Explain why the statement "throw new PromptCreationError" (after creation) in @tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts appears as uncovered",
> AI will use the JSON and lcov files to see the coverage info and analyze the case.

## Git workflow

The repository follows **GitHub flow** with two kinds of branches:

- **`main`** — the shared **integration** branch and the base for all work. Every new
  piece of work starts from here, every pull request is merged back into here, and it is
  always deployable. It is never committed to directly.
- **`spec/<slug>`** — a **feature** branch for building a single spec. `<slug>` is the
  name of the spec being implemented (for example, `spec/archive-prompt`). This is where
  day-to-day changes happen.

A typical feature goes through these steps:

1. Update your local `main` branch: `git checkout main && git pull`.
2. Create a feature branch from it: `git checkout -b spec/<slug>`.
3. Implement the spec, committing as you go (one commit per completed task).
4. Before opening the PR, merge `main` **into** your feature branch (`git checkout main &&
   git pull && git checkout spec/<slug> && git merge main`) so any conflicts resolve on
   the feature branch, not on the target.
5. Push the branch and open a **pull request into `main`**.

> Rule of thumb: never commit to `main` directly — always work on a `spec/<slug>` branch
> and open a pull request into `main`.

## Claude Code

**CLAUDE.md**: Detailed project info (structure, workflows, ...)

### Skills

- **clean-code**: SOLID and Clean Code principles
- **coding-style**: TypeScript coding style guidelines
- **database-schema-design**: Engine-agnostic relational schema-design conventions
- **domain-driven-design**: Domain-Driven Design guidelines for TypeScript
- **node-express-typescript**: Express conventions for TypeScript (excludes business logic directory)
- **spec-driven-development**: Spec-driven (SDD) workflow (agnostic to project)
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

> **.env secrets**: AI has access blocked to all ``.env`` files except ``.env.example``.
> If a plan needs to modify an ``.env`` file, AI will ask user to modify the file MANUALLY.

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

`/spec-implement` also handles the Git branching around implementation: **before** coding
it syncs `main` and cuts the `spec/<slug>` feature branch, and **after** the spec is
implemented it merges `main` back into the feature branch (resolving any conflicts there)
and opens the pull request into `main`.

