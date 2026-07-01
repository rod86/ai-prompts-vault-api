# Plan — Shared Database Client

> **Plan area, step 3.** HOW, mapped onto the architecture. No production code
> yet. See [docs/architecture.md](../../docs/architecture.md).

## Source spec

Link: `./spec.md`

## Bounded context

`src/logic/shared/database/` — **existing** (reserved but empty) shared location. This is
shared infrastructure, not a bounded context: it has no `domain`/`application` layers and
must not import from any context. The `boundaries/element-types` rule enforces that
`shared` may only import other `shared` code (`.eslintrc.json`, `from: "shared"` →
`allow: ["shared"]`); external packages such as `pg` and `drizzle-orm` are permitted.

## Domain layer

- **Entities / value objects:** none — this is a generic infrastructure client.
- **Invariants:** none.
- **Ports:** none. (The client is a concrete adapter over the ORM; contexts will later
  depend on their own repository ports, not on this client directly.)
- **Domain errors:** none — connection errors from the driver propagate as-is.

## Application layer

- **Use cases:** none.
- **Inputs/outputs per use case:** n/a.

## Infrastructure layer

- **Client** (`src/logic/shared/database/DatabaseClient.ts`):
  - `type DatabaseConfig = { host: string; port: number; user: string; password: string; database: string }`.
  - `export default class DatabaseClient<TSchema extends Record<string, unknown>>` with
    `constructor(private readonly schema: TSchema, private readonly config: DatabaseConfig)`.
  - Private lazy field `pool: Pool | undefined`.
  - `connect(): NodePgDatabase<TSchema>` — on first call, construct the `pg` `Pool` from
    `config`; then return `drizzle(this.pool, { schema: this.schema })`. On subsequent
    calls, reuse the existing pool (idempotent).
  - `close(): Promise<void>` — if a pool exists, `await this.pool.end()` and clear the
    field; otherwise no-op.
  - Uses `drizzle-orm/node-postgres` (`drizzle`, `NodePgDatabase`) and `pg` (`Pool`).
  - Strict-TS: no `any`, no non-null assertions, explicit return types; 4-space indent,
    single quotes; ESM `.js` import specifiers (per `docs/coding-style.md`).
- **Validation:** none (no HTTP boundary; config is injected as typed values).
- **Persistence:** this client *is* the shared persistence connection; per-context Drizzle
  repositories and table schemas are deferred to their own features.

## Edges / wiring

- No change to [`src/app.ts`](../../src/app.ts) (no routes).
- [`src/config.ts`](../../src/config.ts): extend the default export with a `database`
  block read from the existing `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_USER` /
  `DATABASE_PASSWORD` / `DATABASE_DB` env vars. `config.ts` remains the only place that
  reads `process.env`; the client receives these values by injection and does **not**
  import `config`.
- [`src/index.ts`](../../src/index.ts) (composition root): construct
  `new DatabaseClient(schema, config.database)`, call `connect()` on startup, and register
  `SIGINT` / `SIGTERM` handlers plus `server.close()` that `await client.close()` for a
  clean shutdown. Until the first bounded context ships a schema, the schema passed in is
  an empty object `{}`.

## Open questions / risks

- **Empty schema for now:** no context defines tables yet, so the client is constructed
  with `{}`. It becomes meaningful once the first context adds
  `infrastructure/database/schema.ts`.
- **Config shape mismatch:** `docs/database.md` references a single `DATABASE_URL` for
  migrations, while the app config and this client use discrete `DATABASE_*` values.
  Reconciling the two is left to a later task.
- **Committed secret:** `.env` currently contains a real password; unrelated to this
  feature but worth flagging for a follow-up.
