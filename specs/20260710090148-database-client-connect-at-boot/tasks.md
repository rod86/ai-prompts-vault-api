# Tasks: Establish the database connection once at startup
Plan: specs/20260710090148-database-client-connect-at-boot/plan.md

<!--
Ordered, test-first. One red→green step per task. Dependency-first; no forward deps.
The client-signature change (T2) transiently breaks the old `DrizzleDatabaseConnection`
consumers until T8–T10 land — the tasks are ordered contiguously so the suite is green
again by T10; run typecheck/lint at final verify.
-->

- [ ] **T1. Add the `globalSchema` re-export module**
  - Type: infrastructure
  - Depends on: none
  - Red: none — `src/modules/shared/infrastructure/database/globalSchema.ts` is a pure
    re-export (`export *` of each modules context schema; currently the prompt schema);
    see testing-practices. Go straight to Green.
  - Green: create `globalSchema.ts` re-exporting
    `@src/modules/prompt/infrastructure/database/schema.js`.
  - Covers: story "single aggregated schema, owned by globalSchema" (plan §2, §9)

- [ ] **T2. Split establish from access with a single memoized connection**
  - Type: infrastructure
  - Depends on: none
  - Red: in `tests/unit/modules/shared/infrastructure/database/DatabaseClient.test.ts`,
    assert that after `connect()`, calling `getConnection()` multiple times constructs the
    pool once and the drizzle connection once, returning the same connection each time
    (`Pool`/`drizzle` each called once; `getConnection()` returns `CONNECTION`). Fails: no
    `getConnection()` exists and `connect()` re-wraps drizzle per call.
  - Green: change `DatabaseClientInterface` to `connect(): void` +
    `getConnection(): DatabaseConnection<NodePgDatabase<Schema>>` + `close()`, generic over
    `Schema`; in `DatabaseClient`, memoize the drizzle connection on `connect()` and return
    it from `getConnection()`.
  - Covers: AC1 "Establish reserves exactly one resource. Given a fresh component, When it is established and then asked for the connection several times, Then only one underlying connection resource is reserved and the same connection is returned each time."

- [ ] **T3. Refuse access before establish**
  - Type: infrastructure
  - Depends on: T2
  - Red: assert `getConnection()` on a never-connected client throws
    `DatabaseNotConnectedError` and no `Pool` is constructed. Fails: no error type / no guard.
  - Green: add `src/modules/shared/infrastructure/database/DatabaseNotConnectedError.ts`;
    `getConnection()` throws it when the memoized connection is undefined.
  - Covers: AC2 "Access before establish is refused. Given a component that has not been established, When a caller asks for the connection, Then the request is refused with the \"connection not established\" signal (E1) and no resource is reserved."; V1; E1

- [ ] **T4. Make establish idempotent**
  - Type: infrastructure
  - Depends on: T2
  - Red: assert calling `connect()` twice constructs the `Pool` exactly once. Fails if
    establish re-creates the pool.
  - Green: `connect()` guards on the existing pool/connection (no-op when already set).
  - Covers: AC3 "Establish is idempotent. Given an already-established component, When establish is requested again, Then still exactly one resource has been reserved."

- [ ] **T5. Release frees the resource and re-locks access**
  - Type: infrastructure
  - Depends on: T3
  - Red: assert that after `connect()` then `close()`, `pool.end()` was called once and a
    subsequent `getConnection()` throws `DatabaseNotConnectedError`. Fails: `close()` does
    not reset the memoized connection, so access still succeeds.
  - Green: `close()` ends the pool and resets both `pool` and `connection` to `undefined`.
  - Covers: AC4 "Release frees the resource and re-locks access. Given an established component, When it is released, Then the resource is freed and a subsequent request for the connection is refused with E1."; E1

- [ ] **T6. Release without establish is a safe no-op**
  - Type: infrastructure
  - Depends on: T2
  - Red: assert `close()` on a never-connected client resolves and never calls `pool.end()`.
  - Green: `close()` returns early when no pool exists.
  - Covers: AC5 "Release without establish is a safe no-op. Given a component that was never established, When release is requested, Then it completes quietly and frees nothing."

- [ ] **T7. Re-establish after release starts fresh**
  - Type: infrastructure
  - Depends on: T5
  - Red: assert `connect()` → `close()` → `connect()` constructs a second `Pool` and a
    following `getConnection()` returns a connection (no throw). Fails if post-close state
    blocks a fresh pool.
  - Green: rely on the reset in T5 so a later `connect()` builds a new pool + connection.
  - Covers: AC6 "Re-establish after release starts fresh. Given a component that was established and then released, When it is established again, Then a new resource is reserved and asking for the connection succeeds."

- [ ] **T8. Bind the shared client to `globalSchema` and export the schema type**
  - Type: infrastructure
  - Depends on: T1, T2
  - Red: none — `src/modules/shared/services.ts` is a composition root; see
    testing-practices. Go straight to Green (validated by typecheck).
  - Green: import `* as globalSchema`; `export type DatabaseSchema = typeof globalSchema`;
    construct `databaseClient` with `globalSchema`; remove the `DrizzleDatabaseConnection`
    type export.
  - Covers: story "one pool, schema aggregated at the composition root" (plan §2, §9)

- [ ] **T9. Inject the client into `DrizzlePromptRepository`**
  - Type: infrastructure
  - Depends on: T2, T3, T8
  - Red: update
    `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`
    `beforeAll` to build `new DatabaseClient(config.database, globalSchema)`, `connect()`,
    take `db = client.getConnection()` for the seed/verify helpers, and inject the **client**
    into the repo (`new DrizzlePromptRepository(client)`); `close()` in `afterAll`. Existing
    behavioral assertions now drive through `getConnection()` and fail (constructor still
    expects a resolved connection) until Green.
  - Green: repo constructor takes `DatabaseClientInterface<DatabaseSchema>`; each query
    method starts with `const db = this.database.getConnection();`; drop the
    `DrizzleDatabaseConnection` import; own-context table imports unchanged.
  - Covers: story "repositories reuse the single established connection" (plan §2, §9)

- [ ] **T10. Inject the client into `DrizzlePromptCategoryRepository`**
  - Type: infrastructure
  - Depends on: T2, T3, T8
  - Red: same change as T9 for
    `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.test.ts`.
  - Green: same repo refactor for `DrizzlePromptCategoryRepository`.
  - Covers: story "repositories reuse the single established connection" (plan §2, §9)

- [ ] **T11. Rewire the prompt composition root**
  - Type: infrastructure
  - Depends on: T8, T9, T10
  - Red: none — `src/modules/prompt/services.ts` is a composition root; see
    testing-practices. Go straight to Green (validated by typecheck + full suite).
  - Green: remove the module-load `databaseClient.connect()`; construct both repos with
    `databaseClient` (the client). Document that app boot must call
    `databaseClient.connect()` once and `close()` on shutdown when modules routes are wired.
  - Covers: story "connection established once at startup, not as an import side effect"
    (plan §1, §2, §9)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Establish reserves exactly one resource. Given a fresh component, When it is established and then asked for the connection several times, Then only one underlying connection resource is reserved and the same connection is returned each time. | T2 |
| AC2 | Access before establish is refused. Given a component that has not been established, When a caller asks for the connection, Then the request is refused with the "connection not established" signal (E1) and no resource is reserved. | T3 |
| AC3 | Establish is idempotent. Given an already-established component, When establish is requested again, Then still exactly one resource has been reserved. | T4 |
| AC4 | Release frees the resource and re-locks access. Given an established component, When it is released, Then the resource is freed and a subsequent request for the connection is refused with E1. | T5 |
| AC5 | Release without establish is a safe no-op. Given a component that was never established, When release is requested, Then it completes quietly and frees nothing. | T6 |
| AC6 | Re-establish after release starts fresh. Given a component that was established and then released, When it is established again, Then a new resource is reserved and asking for the connection succeeds. | T7 |
