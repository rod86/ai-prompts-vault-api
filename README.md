# AI Prompt Vault API

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**, **Domain Driven Design**, and **TDD**.

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

## Claude Code

### Skills

- *clean-code*:  SOLID and Clean Code principles
- *coding-style*: TypeScript coding style guidelines
- *database-schema-design*: Engine-agnostic relational schema-design conventions
- *spec-driven-development*: Spec-driven (SDD) workflow (agnostic to project)
- *domain-driven-design*:  Domain-Driven Design guidelines for TypeScript

## Spec-Driven Development Flow

