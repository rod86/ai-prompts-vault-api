# Tasks — Shared Database Client

> **Plan area, step 4.** An ordered, test-first checklist. Each task is one
> red→green step: write the failing test, then make it pass. No task bundles
> multiple behaviors. See [docs/spec-driven.md](../../docs/spec-driven.md).

## Source plan

Link: `./plan.md`

## Tasks

DB-backed integration is deferred (`docs/tests.md`), so the client is exercised by unit
tests that mock `pg` (`Pool`) and `drizzle-orm/node-postgres` (`drizzle`), living at
`tests/unit/logic/shared/database/DatabaseClient.test.ts` (mirrors the src path).

1. [x] **Connect returns a bound connection** — failing unit test: `connect()` returns the
       Drizzle connection and calls `drizzle` with the pool and `{ schema }` → implement
       `DatabaseClient` with the constructor and `connect()`.
2. [x] **Connect is idempotent** — failing unit test: two `connect()` calls construct the
       `Pool` only once and reuse it → implement lazy pool reuse.
3. [x] **Close releases an open connection** — failing unit test: after `connect()`,
       `close()` calls `pool.end()` and clears the pool → implement `close()`.
4. [x] **Close is a safe no-op when unconnected** — failing unit test: `close()` without a
       prior `connect()` does not throw and does not call `pool.end()` → confirm/implement.
5. [x] **Config** — extend `src/config.ts` with a `database` block from the `DATABASE_*`
       env vars.
6. [x] **Wire into `index.ts`** — construct the client, `connect()` on startup, and
       `await close()` on `SIGINT`/`SIGTERM` + `server.close()` for graceful shutdown.
7. [ ] *(Deferred)* Per-context Drizzle schema + DB-backed integration test.

## Verification

- [x] Every acceptance criterion in `spec.md` maps to a passing test.
- [x] `npm test`, `npm run lint`, `npm run typecheck` are all clean.
