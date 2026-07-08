This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**,
**Domain-Driven Design (DDD)**, and **TDD**. Node 20+, TypeScript 5, Express 5,
PostgreSQL 18 + Drizzle ORM, Vitest.

## Golden rules

1. **No code before an approved spec.** New features/endpoints/behavior changes
   start with the `spec-driven-development` skill (spec → plan → tasks), even if
   the request is phrased as "just add X".
2. **Test-first.** Write the failing test before the implementation (see the
   `testing-practices` skill).
3. **Respect the layers.** Business logic lives in bounded contexts under
   `src/modules/<context>/{domain,application,infrastructure}`. Handlers/middleware
   reach it only through a context's `services.ts`. `eslint-plugin-boundaries`
   enforces this — `npm run lint` must pass. **Put new contexts in `src/modules/`,
   never in `src/logic/`** (see below).
4. **Let the tools format.** Prettier owns formatting; don't hand-format.

## Where the rules live (skills)

This file only captures the **project-specific, library-concrete** patterns. The
underlying principles are owned by skills — read them for anything deeper:

| Skill | Owns |
| --- | --- |
| `spec-driven-development` | The spec → plan → tasks → implement workflow |
| `domain-driven-design` | Bounded contexts, entities, use cases, repositories, domain errors |
| `coding-style` | TypeScript strictness, naming, error handling, imports |
| `testing-practices` | TDD loop, unit vs integration, factories, mocking, DB lifecycle |
| `database-schema-design` | Table/column naming, keys, UTC datetimes, constraints |
| `clean-code` | SOLID / clean-code principles |

## Commands

```bash
npm run dev          # run with hot reload (tsx watch)
npm test             # vitest run — single pass, the CI command
npx vitest run tests/unit/.../X.test.ts    # run one test file
npx vitest run -t 'returns 404'            # filter by test name
npx vitest                                 # watch mode (TDD loop)
npm run lint         # eslint incl. hexagonal boundary rules — must pass
npm run typecheck    # tsc --noEmit
npm run build        # compile to dist/
npm run db:migrate   # drizzle-kit migrate (apply pending migrations)
npx drizzle-kit generate   # emit SQL migrations from schema changes
```

Migrations are run **manually** — the app does not migrate on startup. Requires
a running Postgres (`docker compose up -d`) and DB env vars (see `.env.example`).

## Git branches

The repository uses three branch roles. Tooling and commands should refer to these
**roles**, not the literal names, so the model resolves the current name here:

| Role | Branch | Rules |
| --- | --- | --- |
| **Production** | `main` | Exact mirror of production. Never commit to it or branch feature work off it. |
| **Integration** | `development` | Central branch. Feature branches are cut from it; all PRs target it. |
| **Feature** | `spec/<slug>` | Where a spec's implementation changes are made. `<slug>` is the spec folder's slug (e.g. `spec/archive-prompt`). Cut from the integration branch. |

## Project structure

```
src/
  modules/<context>/    # bounded contexts — the active home for business logic
    domain/             # entities, domain errors, repository interfaces
    application/        # use cases (*.UseCase.ts)
    infrastructure/     # Drizzle repos, adapters, DB schema
    services.ts         # composition root for the context (DI wiring)
  logic/<context>/      # LEGACY business logic (prompt, user, auth, shared) —
                        # being migrated to modules/; don't add new contexts here
  handlers/             # one Express handler per file, default export
  middleware/           # Express middleware (Suffix: *Middleware)
  schemas/              # Zod RequestSchemas, one per handler
  config.ts             # env vars + aggregated Drizzle schema
  app.ts                # HTTP app: middleware + routes (no listen)
  index.ts              # server bootstrap + graceful shutdown
tests/
  lib/                  # shared helpers: config, DB helpers, model factories
  unit/                 # unit tests (mocked deps)
  integration/          # integration tests (real DB, supertest)
specs/                  # SDD specs, one numbered folder per feature
drizzle/                # generated SQL migrations
```

Path aliases (`tsconfig.json`): `@src/*`, `@logic/*` (legacy contexts), `@tests/*`.
New contexts under `src/modules/` are imported via `@src/modules/<context>/...`.
Use aliases instead of long relative chains.

---

## Express Application

**`app.ts` order:** leading global middleware (e.g. JWT) → routes + per-route
middleware (schema validation) → trailing global middleware (404, error handler).

**Handlers (`src/handlers`)** — one function per file, default export, never
inlined in `app.ts`. Read validated input from `req.parsedRequest`, never raw
`req.params`/`query`/`body`:

```typescript
import { type z } from 'zod';
import GetPromptSchema from '@src/schemas/GetPromptSchema.js';

const { id } = req.parsedRequest?.params as z.infer<typeof GetPromptSchema.params>;
```

**Middleware (`src/middleware`)** — one function per file, suffixed `Middleware`.
Always call `next()` (forgetting it hangs the request).

### Request validation

`validateRequestMiddleware(schema)` is a factory taking a `RequestSchema`
(`{ params?, query?, body? }` of Zod schemas). It parses the request via
`validate()` (a thin wrapper around `z.object(schema).safeParse`):

- **failure** → responds `400 { message, errors: { field, error }[] }`, does not
  call `next()`.
- **success** → assigns the parsed, typed result to `req.parsedRequest`, calls
  `next()`.

`req.parsedRequest` is an ambient augmentation in `src/express.d.ts` (kept out of
the middleware file so it only exports runtime logic).

**Schemas (`src/schemas/*Schema.ts`)** — one per handler, default-exporting a
`RequestSchema`-shaped object via `satisfies RequestSchema` (not `as`, which
widens each field to `ZodTypeAny` and breaks `z.infer`):

```typescript
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    body: z.object({
        title: z.string({ error: 'Missing required value' }).min(1),
        description: z.string().optional(),
    }),
} satisfies RequestSchema;
```

**Zod v4 notes (this project is on Zod v4):**
- Use the unified `error` param for custom messages (replaces v3's
  `required_error`/`invalid_type_error`). For a plain string field pass the
  message directly: `z.string({ error: 'Missing required value' })`.
- UUIDs: use top-level `z.uuid()`, not the deprecated `z.string().uuid()`. Since
  it merges type + format checks, branch on the issue code for distinct messages:
  ```typescript
  category_id: z.uuid({
      error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value'),
  }),
  ```
  
---

## Business Logic

Busines logic lives in `src/modules` and follows *Domain Driven Design* conventions from `domain-driven-design` skill

---

## Persistence (Drizzle ORM + pg)

ORM: `drizzle-orm/node-postgres`; engine: PostgreSQL via a `pg` `Pool`.

**`DatabaseClient<DatabaseSchema>`** (`src/logic/shared/database/DatabaseClient.ts`)
wraps a lazily-created `Pool` and returns a Drizzle connection typed to its schema:

```ts
const client = new DatabaseClient(config, schema); // schema inferred
const db = client.connect();  // DatabaseConnection<typeof schema>, reuses Pool
await client.close();         // ends Pool, idempotent / no-op if never connected
```

- Use the exported `DatabaseConnection` type alias for any `db` param/return —
  **never** hand-write `NodePgDatabase<Record<string, unknown>>`.
- Repositories take a `DatabaseConnection`, so wire them with
  `new DrizzlePromptRepository(databaseClient.connect())` in `services.ts`.
- Schema is aggregated in `config.ts` by spreading each context's schema into one
  flat `{ tableName: table }` object Drizzle expects.
- `id` (uuid) is **app-provided on insert** — no `defaultRandom()` /
  `gen_random_uuid()` defaults.

**Tests** get their own `databaseClient` in `tests/lib/config.ts` (kept separate
from the app's per the `testing-practices` rule that `lib` resources stay in
`tests` scope). Use its `TestDatabaseConnection` type for `db` params in DB
helpers and integration tests.

---

## Testing (Vitest)

The `testing-practices` skill owns the portable conventions (TDD loop, placement,
factories, mocking, error assertions, DB lifecycle). This section pins the bits
specific to **this** app.

**Stack:** Vitest runner with path aliases via `vite-tsconfig-paths`;
`vitest-mock-extended` (`mock<T>()` → `MockProxy<T>`) for interfaces/classes and
`vi.fn()` for functions; `supertest` for HTTP; `@faker-js/faker` for sample data.

**Layer → test type** (the project's DDD layers mapped onto the skill's
isolated-vs-real distinction):
- **Use cases** (`application` layer) → **unit**, all dependencies mocked.
- **Adapters** (`infrastructure` layer, e.g. Drizzle repositories) and
  **routes/handlers** (wired in `app.ts`) → **integration**, against a real
  DB/HTTP.

**Test helpers (`tests/lib`):**
- `tests/lib/config.ts` exports the test `databaseClient`, the
  `TestDatabaseConnection` type, and singleton model factories — kept separate
  from the app's `@logic/shared/services.ts` client (lib resources stay in `tests`
  scope).
- `tests/lib/database/*.ts` — one file per table with direct insert/select/delete
  helpers (e.g. `selectPromptsByIds`). Use these to verify writes, not the
  repository's own read method or another route.

**Example files to copy from:** `ListPromptsUseCase.test.ts` (unit, local
`buildPrompt` builder), `DrizzlePromptRepository.test.ts` /
`DrizzlePromptCategoryRepository.test.ts` (integration DB lifecycle + shared
reference categories), `GetPromptsHandler.test.ts` (route + `fixturesInResponse`
filtering), `DeletePromptHandler.test.ts` (write verified via direct query).

**Schema** is managed outside test scope — migrations must be applied before
running the suite (`npm run db:migrate`).

### Request-validation tests

For a handler whose route is wired with `validateRequestMiddleware` (responds
`400 { message, errors: { field, error }[] }` on invalid input), nest a
`describe('Request Validation', ...)` inside the handler's top-level `describe`:

- One test sending an empty payload/query, asserting an error for every required
  field.
- One additional test per other meaningful validation case (e.g. a malformed UUID).

Assert the `errors` array with exact `{ field, error }` object literals (including
the literal message text) — not `expect.objectContaining`, which lets an unrelated
message change pass silently. Don't re-assert the top-level `message` string in
each handler test — the middleware's own unit test
(`tests/unit/middleware/validateRequest/*.test.ts`) already covers it once. If a
schema has no field that can actually fail (e.g. a route param that's always a
non-empty string), omit the block entirely rather than fabricating a failing case.

```ts
describe('Request Validation', () => {
    it('returns missing required value errors for all required fields', async () => {
        const response = await request(app).post('/prompts').send({});

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            errors: expect.arrayContaining([
                { field: 'body.title', error: 'Missing required value' },
                { field: 'body.category_id', error: 'Missing required value' },
            ]),
        });
    });
});
```

---

## Tooling

- **Boundaries:** `eslint-plugin-boundaries` enforces the hexagonal dependency
  rule and blocks deep cross-context reach-ins.
- **Formatting:** Prettier — 4-space indent, single quotes, trailing commas,
  100-col width.
