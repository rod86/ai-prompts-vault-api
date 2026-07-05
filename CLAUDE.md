# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
nvm use            # match the Node version in .nvmrc (24.16.0)
npm install
npm run dev        # run the API with hot reload (tsx) on PORT (default 3000)
npm run build      # tsc -> dist/
npm start          # run compiled dist/index.js
npm test           # vitest run (single pass)
npm run lint       # eslint (includes hexagonal boundary enforcement)
npm run typecheck  # tsc --noEmit
```

Run a single test file or test by name:

```bash
npx vitest run tests/integration/health.test.ts
npx vitest run -t 'returns 200'        # filter by test name
npx vitest                              # watch mode
```

There are only the six npm scripts above by design — do not add more without reason.

## Conventions live in skills

The authoritative conventions live as skills under `.claude/skills/`, preloaded
into the `planner` and `implementer` agents:

- `spec-planner` / `spec-implementation` — the spec-driven workflow (required
  for all feature work, with a hard gate between planning and coding).
- `hexagonal-architecture` — layers, bounded contexts, dependency rule, wiring.
- `coding-style` — TypeScript, naming, clean-code, error, and import rules.
- `testing` — TDD loop, unit vs integration, mocking strategy.
- `database-modeling` — table/column conventions and migrations.
- `project-stack` — the concrete library patterns (Express, Drizzle/pg, Zod,
  Vitest, drizzle-kit) to mirror when writing code.

## Stack

| Library                                                     | Version            | Role                                       |
| ----------------------------------------------------------- | ------------------ | ------------------------------------------ |
| Node                                                        | 24.16.0 (`.nvmrc`) | runtime                                    |
| TypeScript                                                  | v5, `strict`       | language                                   |
| Express                                                     | v5                 | HTTP framework                             |
| Drizzle ORM + `pg`                                          | node-postgres      | persistence over PostgreSQL (`Pool`)       |
| drizzle-kit                                                 | —                  | migrations (run via `npx`, no npm scripts) |
| Zod                                                         | —                  | validation at the HTTP boundary            |
| Vitest + supertest + vitest-mock-extended + @faker-js/faker | —                  | testing                                    |
| Prettier + ESLint (+ eslint-plugin-boundaries)              | —                  | formatting + boundary linting              |

Must-know rules:

- `process.env` is read **only** in `src/config.ts`.
- Validate all external input with Zod at the HTTP boundary; only parsed values
  flow inward.
- Migrations run manually via `npx drizzle-kit generate|migrate` — the app never
  migrates on startup, and there are no npm scripts for it.
- Tests live under `tests/`, mirroring the `src/` path; never inside `src/`.
- Path aliases `@src/*` and `@logic/*` instead of long relative chains.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
