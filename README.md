<p align="center">
  <img width="100" height="100" alt="ai-prompt-vault-icon" src="https://github.com/user-attachments/assets/1e75cd54-8f85-4ab4-9979-1bd0aa20932a" />
</p>

# AI Prompt Vault API

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**, **Domain Driven Design**, and **TDD**.

<p align="center">
  <img height="30" alt="claude-badge" src="https://github.com/user-attachments/assets/ab5deb13-e3a0-4574-825b-989112284e90" />
</p>

- [Tech stack](#tech-stack)
- [API endpoints](#api-endpoints)
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

## API endpoints

All request and response bodies are JSON with `snake_case` field names.

Prompt endpoints require authentication: obtain a JWT from `POST /authenticate`
and send it as a bearer token in the `Authorization` header
(`Authorization: Bearer <token>`). Every error shares a uniform envelope —
`{ status, code, message }`, plus a `details` object for request-validation
failures. See [Error responses](#error-responses) for the full list.

### Health check

- **Method:** `GET`
- **URL:** `/health`
- **Success response — `200 OK`:**

```json
{ "status": "ok" }
```

### Register a user

- **Method:** `POST`
- **URL:** `/users`
- **Content-Type:** `application/json`
- **Request body** (`password` must be at least 8 characters):

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "correct horse battery"
}
```

- **Success response — `201 Created`:**

```json
{
  "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "created_at": "2026-07-14T10:30:00.000Z",
  "updated_at": "2026-07-14T10:30:00.000Z"
}
```

- **Errors:** `422 EMAIL_ALREADY_IN_USE` if the email is already registered;
  `400 VALIDATION_ERROR` for invalid input.

### Authenticate

Exchange credentials for a JWT bearer token used on the prompt endpoints.

- **Method:** `POST`
- **URL:** `/authenticate`
- **Content-Type:** `application/json`
- **Request body:**

```json
{
  "email": "ada@example.com",
  "password": "correct horse battery"
}
```

- **Success response — `200 OK`:**

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

- **Errors:** `401 INVALID_CREDENTIALS` if the email or password is wrong;
  `400 VALIDATION_ERROR` for invalid input.

### List prompt categories

- **Method:** `GET`
- **URL:** `/prompt-categories`
- **Success response — `200 OK`:**

```json
[
  { "id": "3f2a6c1e-9b4d-4f0a-8c7e-1d2b3a4c5d6e", "name": "Writing" },
  { "id": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", "name": "Coding" }
]
```

### Create a prompt

- **Method:** `POST`
- **URL:** `/prompts`
- **Auth:** required — `Authorization: Bearer <token>`. The authenticated user
  becomes the prompt's creator.
- **Content-Type:** `application/json`
- **Request body** (`description` is optional):

```json
{
  "title": "Refactor helper",
  "prompt": "Refactor the following function for readability: {{code}}",
  "category_id": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "description": "Cleans up a code snippet"
}
```

- **Success response — `201 Created`:**

```json
{
  "id": "c4d5e6f7-a8b9-4c0d-8e1f-2a3b4c5d6e7f",
  "title": "Refactor helper",
  "prompt": "Refactor the following function for readability: {{code}}",
  "description": "Cleans up a code snippet",
  "category": { "id": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", "name": "Coding" },
  "user": { "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "name": "Ada Lovelace" },
  "created_at": "2026-07-14T10:30:00.000Z",
  "updated_at": "2026-07-14T10:30:00.000Z"
}
```

### Update a prompt

- **Method:** `PUT`
- **URL:** `/prompts/:id`
- **Auth:** required — `Authorization: Bearer <token>`. Only the prompt's creator
  may update it.
- **Content-Type:** `application/json`
- **Request body** (`description` is optional):

```json
{
  "title": "Refactor helper (v2)",
  "prompt": "Refactor the following function for readability and performance: {{code}}",
  "category_id": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "description": "Cleans up and optimizes a code snippet"
}
```

- **Success response — `200 OK`:**

```json
{
  "id": "c4d5e6f7-a8b9-4c0d-8e1f-2a3b4c5d6e7f",
  "title": "Refactor helper (v2)",
  "prompt": "Refactor the following function for readability and performance: {{code}}",
  "description": "Cleans up and optimizes a code snippet",
  "category": { "id": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", "name": "Coding" },
  "user": { "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "name": "Ada Lovelace" },
  "created_at": "2026-07-14T10:30:00.000Z",
  "updated_at": "2026-07-14T11:15:00.000Z"
}
```

### Delete a prompt

- **Method:** `DELETE`
- **URL:** `/prompts/:id`
- **Auth:** required — `Authorization: Bearer <token>`. Only the prompt's creator
  may delete it.
- **Success response — `204 No Content`** (empty body).

### Error responses

Every error returns the same envelope — `{ status, code, message }` — with the
transport status mirrored in `status`. Request-validation failures (`400`) add a
`details` object keyed by request part (`body`, `params`, `query`).

| Status | `code`                 | When                                                            |
| ------ | ---------------------- | --------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`     | Request body/params failed schema validation (includes `details`). |
| 401    | `INVALID_CREDENTIALS`  | Wrong email or password at `POST /authenticate`.                |
| 401    | `MISSING_TOKEN`        | No/blank bearer token on an authenticated route.                |
| 401    | `INVALID_TOKEN`        | Token is malformed or its signature is invalid.                 |
| 401    | `TOKEN_EXPIRED`        | Token has expired.                                              |
| 403    | `PROMPT_OWNERSHIP`     | Updating/deleting a prompt you did not create.                  |
| 404    | `PROMPT_NOT_FOUND`     | No prompt exists with the given id.                             |
| 422    | `CATEGORY_NOT_FOUND`   | `category_id` does not match an existing category.              |
| 422    | `EMAIL_ALREADY_IN_USE` | Email already registered at `POST /users`.                      |
| 500    | `INTERNAL_ERROR`       | Unexpected server error (cause logged server-side, not exposed). |

Example business error (`403`):

```json
{
  "status": 403,
  "code": "PROMPT_OWNERSHIP",
  "message": "You are not allowed to modify or delete this prompt: c4d5e6f7-a8b9-4c0d-8e1f-2a3b4c5d6e7f"
}
```

Example validation error (`400`):

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request Validation data failed",
  "details": {
    "body": {
      "title": "Missing required value",
      "category_id": "Invalid UUID value"
    }
  }
}
```

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
  modules/<context>/       # bounded contexts — the home for business logic (auth, prompt, user, shared)
    domain/                # entities, domain errors, repository interfaces
    application/           # use cases
    infrastructure/        # Adapters (drizzle repositories, Token Generators,...)
    services.ts            # Context services setup (DI wiring)
  handlers/                # HTTP route handler
  middleware/              # Express middleware
  routes/                  # Express routers + request-validation schemas
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
specs/                     # spec-driven development specs, one folder per feature
drizzle/                   # generated SQL migrations
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

> **.env secrets**: AI will never have access to any ``.env`` file (``.env.example``). Its access is locked.
> If a plan needs to modify an ``.env`` file, AI will ask user to modify MANUALLY the file.

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

