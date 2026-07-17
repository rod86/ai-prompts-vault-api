This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A REST API to manage AI prompts, built with **Spec-Driven Development (SDD)**,
**Domain-Driven Design (DDD)**, and **TDD**. Node 24+, TypeScript 5, Express 5,
PostgreSQL 18 + Drizzle ORM, Vitest.

## Golden rules

1. **No code before an approved spec.** New features/endpoints/behavior changes
   need an approved spec authored via the `/spec-plan` command — never start the
   planning workflow or write code on your own initiative. Talking through and
   defining a feature in conversation is fine and expected: that is not planning,
   needs no spec, and should not trigger a "run /spec-plan" nag. When the user is
   ready they run `/spec-plan`, which turns the preceding discussion (plus any
   argument) into the `spec.md`/`plan.md`/`tasks.md` artifacts.
2. **Test-first.** Write the failing test before the implementation (see the
   `testing-practices` skill).
3. **Respect the layers.** Business logic lives in bounded contexts under
   `src/modules/<context>/{domain,application,infrastructure}`. Handlers/middleware
   reach it only through a context's `services.ts`. `eslint-plugin-boundaries`
   enforces this — `npm run lint` must pass.
4. **Let the tools format.** Prettier owns formatting; don't hand-format.
5. **Git is `/spec-implement`'s job — or an explicit instruction's.** Outside
   `/spec-implement`'s documented flow, never invoke git or `gh` on your own
   initiative — not for `/spec-plan`, ad-hoc fixes, skill/doc edits, or exploration,
   and not even read-only inspection (`status`, `diff`, `log`, `pull`). **The one
   exception:** when the user explicitly tells you to (e.g. "commit at the end",
   "push this", "open a PR"), do exactly what they asked and nothing more. Absent such
   an instruction, leave every change as an uncommitted working-tree edit; committing,
   pushing, and opening/editing PRs otherwise happen only inside `/spec-implement`'s
   steps (see "Git branches" below).
6. **When in doubt, guidelines win — then ask.** When comparing two ways to write
   or organize code, or unsure which pattern to follow, prefer whichever option
   more closely follows this file and its skills (`spec-driven-development`,
   `domain-driven-design`, `node-express-typescript`, `coding-style`,
   `testing-practices`, `database-schema-design`, `clean-code`) — even if the other option looks more
   familiar or shorter. If it's still unclear which option follows the
   guidelines more closely, or the guidelines themselves conflict, don't guess —
   ask the user.

## Where the rules live (skills)

This file only captures the **project-specific, library-concrete** patterns. The
underlying principles are owned by skills — read them for anything deeper:

| Skill | Owns |
| --- | --- |
| `spec-driven-development` | The spec → plan → tasks → implement workflow |
| `domain-driven-design` | Bounded contexts, entities, use cases, repositories, domain errors |
| `node-express-typescript` | Express 5 HTTP layer: app/server boot, routers, middleware ordering, request validation, centralized error handling, custom `req` typing |
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

Per Golden Rule 5, everything below only ever happens inside `/spec-implement`'s
documented steps — not ad-hoc.

The repository uses two branch roles. Tooling and commands should refer to these
**roles**, not the literal names, so the model resolves the current name here.
Commands may bind the roles to parameter names — the `spec-implement` command
resolves the integration role to **`BASE_BRANCH`** and the feature role to
**`FEATURE_BRANCH`**.

| Role | Branch        | Rules                                                                                                                                                                                                                                                                                                    |
| --- |---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Integration** (`BASE_BRANCH`) | `main`        | Central branch; feature branches are cut from it and all PRs target it.                                                                                                                                                                                                                                |
| **Feature** (`FEATURE_BRANCH`) | `spec/<slug>` | Where a spec's implementation changes are made. `<slug>` is the spec folder's slug (e.g. `spec/archive-prompt`). Cut from the integration branch. Before opening a PR, merge the integration branch **into** the feature branch so any conflicts resolve here, on the feature branch, not on the target. |

## Project structure

```
src/
  modules/<context>/    # bounded contexts — the home for business logic
    domain/             # entities, domain errors, repository interfaces
    application/        # use cases (*.UseCase.ts)
    infrastructure/     # Drizzle repos, adapters (schema lives in src/config/drizzle/)
    services.ts         # composition root for the context (DI wiring)
  config/
    config.ts           # env vars + fixed params (default-exported, no schema)
    drizzle/            # centralized Drizzle schema (outside every bounded context)
      user.schema.ts    # per-context table definitions
      prompt.schema.ts  #   (prompts → users FK is a sibling import here)
      schema.ts         # internal aggregation (export *) — drizzle-kit points here
      index.ts          # barrel: `schema` object + DatabaseSchema/DatabaseConnection/PromptSchema/UserSchema
  routes/
    <resource>/         # per-resource: *.routes.ts + *.request.schema.ts + *.response.schema.ts
    shared/             # cross-resource: fields.schema.ts (uuidField/emailField) + error.response.schema.ts
  handlers/<resource>/  # HTTP handlers: wire-shape mapping, reach contexts via services.ts
  middleware/           # error / 404 / auth / validation / rate-limit middleware
  docs/                 # OpenAPI document composition root (zod-openapi) + global.ts (shared response fragments) + one paths file per functional area
  errors/               # ApiError — HTTP-boundary error (explicit status + code)
  types/                # express.d.ts — custom `req` property typing
  app.ts                # HTTP app: middleware stack + routes (no listen)
  index.ts              # server bootstrap + graceful shutdown
tests/
  lib/                  # shared helpers: model factories, fixtures, DB read-back helpers
  unit/                 # unit tests (mocked deps)
  integration/          # integration tests (real DB, supertest)
public/                 # static files served as-is (express.static); docs page + service icon
  docs/index.html       # interactive API docs page (Scalar, loaded from a pinned CDN)
  logo.png              # service icon — replaceable by swapping the file
specs/                  # SDD specs, one timestamped folder per feature
drizzle/                # generated SQL migrations
coverage/               # Test coverage reports
```

Path aliases (`tsconfig.json`): `@src/*`, `@tests/*`. Contexts under
`src/modules/` are imported via `@src/modules/<context>/...`. Use aliases
instead of long relative chains.

---

## Express Application

Express 5 conventions — app/server boot, routers, middleware ordering, request
validation, centralized error handling + 404, and custom `req` typing — are owned
by the **`node-express-typescript` skill**; follow it when adding routes back.

`src/app.ts` wires the app in this order: `app.set('trust proxy',
config.trustProxyHops)`, `express.json()`, the documentation surface —
`GET /openapi.json` then `express.static(public/)` — the global rate limiter,
then the API router (`src/routes/index.ts`, composing the per-resource
routers), then `notFoundMiddleware` and `errorMiddleware` last. The
documentation surface is mounted **before** the rate limiter, so it carries no
allowance information; every other endpoint's behavior is unchanged. The
health check is a first-class resource like any other — `healthRouter`
(`src/routes/health/health.routes.ts`) is mounted first inside the API
router, so `GET /health` → `healthHandler` → `200 { status: 'ok' }` stays
behind the global rate limiter. Each router (`src/routes/<resource>/*.routes.ts`)
chains per-route middleware — `validateRequestMiddleware` with the sibling
`*.request.schema.ts` schema, `requireAuthMiddleware` where the route needs a
user — into a handler under `src/handlers/<resource>/`.

**Rate limiting.** Two limiters, both built by the shared factory
`src/middleware/rateLimit/createRateLimitMiddleware.ts` (wraps
`express-rate-limit`; `standardHeaders: 'draft-8'`, no legacy headers; on an
exhausted allowance it forwards `new ApiError(429, 'TOO_MANY_REQUESTS', …)` so
`errorMiddleware` emits the uniform envelope, alongside `Retry-After` and the
draft-8 `RateLimit-*` headers):

- **Global** — `app.use(createRateLimitMiddleware(config.rateLimit))` in
  `app.ts`; every request on every endpoint counts. Defaults: 100 requests /
  15 min (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).
- **Login** — first handler of `POST /authenticate`
  (`src/routes/auth/auth.routes.ts`), built from `config.loginRateLimit` with
  `skipSuccessfulRequests: true`, so only failed attempts (status ≥ 400)
  consume the allowance; once exhausted, even correct credentials get the same
  429 — deliberately indistinguishable from the general limit. Defaults: 5
  failed attempts / 15 min (`LOGIN_RATE_LIMIT_MAX`,
  `LOGIN_RATE_LIMIT_WINDOW_MS`).

Client identity is the connection IP, or the forwarded IP when behind trusted
proxies — governed by `TRUST_PROXY_HOPS` (default 0; keep ≥ 1 behind a proxy
and for the integration suite, see `.env.example`). Counters live in
`express-rate-limit`'s default in-memory store: per process, reset on restart,
no DB tables.

**Wire params are `snake_case`.** Every client-facing endpoint parameter uses
`snake_case`, not `camelCase`:

- **Input** — applies to `query`, `params`, and `body` (e.g. `category_id`,
  not `categoryId`). Request-validation schemas declare the `snake_case` names.
- **Output** — response bodies use `snake_case` (e.g. `created_at`, `updated_at`).

The domain stays `camelCase` (entities, use-case queries, repositories). The
`snake_case` ⇄ `camelCase` translation is a **boundary concern owned by the HTTP
layer** (handlers/middleware) — **never** inside the business-logic layer
(`src/modules/<context>/{domain,application}`). Use cases receive and return
`camelCase`; the handler maps to/from the `snake_case` wire shape.

**Error envelope is uniform.** Every error response body is exactly
`{ status, code, message }`, plus `details` only for a request-validation
failure — the one property no other error ever carries. `status` always
mirrors the transport status; `code` is a stable, client-facing identifier,
never an internal class name. Business errors extend the shared `DomainError`
base (`src/modules/shared/domain/DomainError.ts`), declaring a `code` and a
`category` (`NotFound | Forbidden | Unauthorized | Unprocessable`);
`src/middleware/errorMiddleware.ts` maps `category → status` via
`CATEGORY_STATUS` (`src/middleware/domainErrorStatus.ts`) in one central
branch — a new business error that reuses an existing `category` needs no
middleware edit. HTTP-boundary errors that aren't business errors use
`ApiError` (`src/errors/ApiError.ts`), which carries an explicit transport
`status` + `code` (e.g. the rate limiters' 429 `TOO_MANY_REQUESTS`);
`errorMiddleware` maps it into the same envelope. An
unexpected/technical failure falls through to a generic
`INTERNAL_ERROR` 500; the underlying cause is logged server-side
(`console.error`) but never sent to the client. See `domain-driven-design`
for the `DomainError` subclassing rules and `node-express-typescript` for the
middleware pattern.

**API documentation.** `src/docs/api.ts` is the composition root: `zod-openapi`'s
`createDocument` assembles `info`, `servers`, the `bearerAuth` security scheme,
and `paths` spread in from one file per functional area
(`src/docs/health.ts`, `auth.ts`, `users.ts`, `prompts.ts`), served at
`GET /openapi.json`. Paths reuse the **existing** request-validation schemas
(`src/routes/<resource>/*.request.schema.ts`, via `.shape`) plus a sibling
`*.response.schema.ts` per resource (and `src/routes/shared/error.response.schema.ts`
for the common error/validation-error shapes) — so documented request and
response shapes cannot drift from what the API actually validates and returns.
`src/docs/global.ts` exports spreadable response fragments
(`unauthorizedResponse`, `rateLimitedResponse`, `validationErrorResponse(...)`)
reused across the per-resource paths files.
Handlers type their response body from the response schema's inferred type
(`RequestHandler<Params, ResBody>`) and map `Date` fields via
`.toISOString()`; the schemas are declaration-only at runtime (no `.parse()`
in production code) — truthfulness is proven instead by a per-endpoint
`<X>ResponseSchema.parse(response.body)` assertion in that handler's
integration test. The interactive UI (`GET /docs/`) is a static page
(`public/docs/index.html`) loading Scalar from a pinned jsDelivr CDN URL and
pointing it at `/openapi.json`.

---

## Business Logic

Business logic lives in `src/modules` and follows *Domain Driven Design* conventions from `domain-driven-design` skill

---

## Persistence (Drizzle ORM + pg)

ORM: `drizzle-orm/node-postgres`; engine: PostgreSQL via a `pg` `Pool`.
Connection-lifecycle conventions are owned by `node-express-typescript` §3.

**`DatabaseClient<DatabaseSchema>`**
(`src/modules/shared/infrastructure/database/DatabaseClient.ts`) wraps a
lazily-created `Pool` and returns a Drizzle connection typed to its schema:

```ts
const client = new DatabaseClient(config, schema); // schema inferred
client.connect();                  // opens the Pool + Drizzle connection (returns void)
const db = client.getConnection(); // DatabaseConnection, reuses the Pool
await client.close();              // ends Pool, idempotent / no-op if never connected
```

- Use the exported `DatabaseConnection` type alias (from
  `src/config/drizzle/index.ts`) for any `db` param/return — **never**
  hand-write `NodePgDatabase<Record<string, unknown>>`.
- Repositories take the `DatabaseClient` port **plus an injected schema view**
  (a per-context `Pick<DatabaseSchema, …>` — `PromptSchema` / `UserSchema`) and
  destructure the tables they need from `this.schema`; they import only schema
  **types** from the barrel, never the table objects. Wire them with
  `new DrizzlePromptRepository(databaseClient, schema)` in `services.ts` (the
  full merged `schema` is structurally assignable to any `Pick` of it).
- Config is split into two units: `src/config/config.ts` (env vars + fixed
  params, no schema) and `src/config/drizzle/` (the centralized schema). The
  schema lives **outside** the business-logic directory (`src/modules/`) on
  purpose: the ORM couples schema definitions across contexts (cross-context
  FKs / joins share table objects), so co-locating a table inside a context
  would force cross-context imports. Centralizing it keeps contexts from
  importing one another's schema. Runtime/app code imports `{ schema }` from
  `@src/config/drizzle/index.js` (the barrel) and accesses tables via
  `schema.<table>` — never a per-context `*.schema.ts` file. The internal
  `schema.ts` aggregation (`export *`) exists only because drizzle-kit
  discovers tables from top-level `pgTable` exports; `drizzle.config.ts` points
  at it, not at the barrel.
- `id` (uuid) is **app-provided on insert** — no `defaultRandom()` /
  `gen_random_uuid()` defaults.

**Tests** reuse the app's `databaseClient` (the singleton from
`@src/modules/shared/services.js`) rather than constructing their own — it is
re-exported from `tests/lib/config.ts`, and `tests/integration.setup.ts` opens
it in `beforeAll` / closes it in `afterAll` once per integration file (wired to
the `integration` Vitest project only, so unit runs never touch the DB).
Fixtures and the app-under-test share this one client, so a single
connect()/close() covers both. Repository tests still pass `schema` (imported
from `@src/config/drizzle/index.js`) to the repository constructor —
`new DrizzlePromptRepository(databaseClient, schema)` — see
`DrizzlePromptRepository.test.ts` for the pattern.

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

**Rate limits in route tests:** the app under test mounts both rate limiters,
so requests in a test file count against a shared per-client allowance. Give
each test its own client identity via a unique `X-Forwarded-For` IP — this
needs `TRUST_PROXY_HOPS` ≥ 1, which `.env.example` already sets — so tests
never share a bucket.

**Test helpers (`tests/lib`):**
- `tests/lib/config.ts` re-exports the shared `databaseClient` and its
  `TestDatabaseClient`/`TestDatabaseConnection` types, exports the singleton
  model factories, and exports a `create<Entity>Fixture()` factory function per
  table (`createUserFixture`, `createPromptFixture`,
  `createPromptCategoryFixture`).
- `tests/lib/modelFactories/*.ts` — one factory per domain type building
  fake-but-valid instances (`AbstractModelFactory<T>` base).
- `tests/lib/fixtures/*.ts` — one **fixture class** per table
  (`AbstractFixture<T>` base). A fixture wraps the `databaseClient` + that
  table's model factory; `insert(data?)` builds a row via the factory, persists
  it, tracks its id, and returns the model; `cleanup()` deletes every id it
  tracked; `register(id)` tracks an externally-created row (one the app or a
  repository inserted) so `cleanup()` also removes it. Instantiate one per
  `describe` via the `create<Entity>Fixture()` helper; insert per-test rows in
  the `it`, insert shared parent/reference rows in `beforeAll`, and drive
  teardown from `cleanup()` in `afterEach`/`afterAll` (child fixtures before
  parents).
- `tests/lib/database/*.ts` — one file per table with **read-back** helpers only
  (e.g. `selectPromptsByIds`, `selectUsersByEmail`); writes and deletes go
  through the fixtures. Use these to verify a write landed, not the repository's
  own read method or another route.

**Example files to copy from:** `ListPromptsUseCase.test.ts` (unit, local
`buildPrompt` builder), `DrizzlePromptRepository.test.ts` /
`DrizzlePromptCategoryRepository.test.ts` (integration DB lifecycle + fixtures +
shared reference categories), `deletePromptHandler.test.ts` (route test wiring
category/user/prompt fixtures), `app.test.ts` (app-level concerns: not-found
contract, error/generic middleware — not per-route tests),
`healthHandler.test.ts` (health check response + documented-shape assertion),
`loginRateLimitMiddleware.test.ts` (middleware behavior pinned per acceptance
criterion, unique `X-Forwarded-For` per test), `docs.test.ts` (a non-handler
HTTP surface — `/openapi.json` content, the `/docs/` static page, static
files, and the rate-limit exemption — not tied to a single handler, so it
isn't folded into `app.test.ts`).

**Schema** is managed outside test scope — migrations must be applied before
running the suite (`npm run db:migrate`).

**Coverage:** `npm test` runs with coverage on (`vitest run --coverage`, v8
provider, configured in `vitest.config.ts`), reporting into `coverage/` in four
formats. When checking coverage, only read `coverage/coverage-summary.json`
(per-file totals) and `coverage/lcov.info` (line/branch detail) — those are
the formats meant for you; ignore other formats, which are for the user.
`src/docs` is excluded from coverage — it's declarative composition, not
logic; its behavior is pinned only through the tests of the endpoints it
documents.

---

## Tooling

- **Boundaries:** `eslint-plugin-boundaries` enforces the hexagonal dependency
  rule and blocks deep cross-context reach-ins.
- **Formatting:** Prettier — 4-space indent, single quotes, trailing commas,
  100-col width.
