# Plan: Establish the database connection once at startup
Spec: specs/20260710090148-database-client-connect-at-boot/spec.md

<!--
HOW. Maps every spec element onto the project's DDD structure (modules/<context>/
{domain,application,infrastructure} + services.ts composition roots).
-->

## 1. Approach

Split the shared `DatabaseClient`'s single overloaded `connect()` into a **lifecycle**
pair and an **access** getter, so the connection pool is opened exactly once and then
reused, instead of a new Drizzle wrapper being built on every call and the pool being
opened as an import side effect.

- `connect()` becomes a lazy lifecycle op: create the `pg` `Pool` once and memoize a
  single `drizzle()` connection. Idempotent.
- `getConnection()` is the access getter: returns the memoized connection, or throws a
  new `DatabaseNotConnectedError` when nothing is established (spec V1/E1).
- `close()` ends the pool and resets both the pool and the memoized connection so a later
  `connect()` starts fresh. Idempotent no-op when never connected.

Repositories stop receiving a pre-resolved connection and instead receive the client
(typed as `DatabaseClientInterface`), calling `getConnection()` at the top of each query
method — so the connection is resolved lazily at query time (post-boot). Context schemas
are aggregated inside `src/config.ts`'s existing `database.schema` object rather than a
new module under `src/modules/shared`: `eslint-plugin-boundaries` forbids a
`shared`-context infrastructure file from depending on another context's (`prompt`'s)
infrastructure, and `config.ts` is the one place already exempt from that check (it sits
outside `src/logic/*`/`src/modules/*`) and already performs this exact kind of
cross-context aggregation for the legacy schema. The existing legacy imports are renamed
`legacyPromptSchema`/`legacyUserSchema` to flag them as temporary until the `@logic/*`
migration retires them; the modules-side `prompt` schema is added under a plain name and
mixed into the same object (see Decision 5, spec §6).

Scope is `src/modules/shared` (+ the `modules/prompt` repos/services that consume it)
**and `src/config.ts`'s schema aggregation** (renamed legacy imports + the added modules
`prompt` import — see Decision 5). The legacy `@logic/*` client, `src/index.ts`,
migrations, and the test suite's own `databaseClient` in `tests/lib/config.ts` are **not**
touched.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `DatabaseClientInterface` | existing | `src/modules/shared/domain/interfaces/DatabaseClientInterface.ts` | Replace `connect(): DatabaseConnection` with `connect(): void`; add `getConnection(): DatabaseConnection<NodePgDatabase<Schema>>`; keep `close(): Promise<void>`. Make the interface generic over `Schema`. |
| `DatabaseClient` | existing | `src/modules/shared/infrastructure/database/DatabaseClient.ts` | Memoize the drizzle connection in a private field on `connect()`; `getConnection()` returns it or throws `DatabaseNotConnectedError`; `close()` resets pool **and** connection. |
| `DatabaseNotConnectedError` | **new** | `src/modules/shared/infrastructure/database/DatabaseNotConnectedError.ts` | Error thrown by `getConnection()` when no connection is established (E1). |
| `config` (schema aggregation) | existing | `src/config.ts` | Rename legacy schema imports to `legacyPromptSchema`/`legacyUserSchema`; add a `promptSchema` import from `@src/modules/prompt/infrastructure/database/schema.js`; mix all three into `database.schema: { ...legacyPromptSchema, ...legacyUserSchema, ...promptSchema }`. Single default export only — no new named export (see Decision 5, spec §6). |
| `services` (shared) | existing | `src/modules/shared/services.ts` | Bind `databaseClient` to `config.database.schema`; `export type DatabaseSchema = typeof config.database.schema`; remove `DrizzleDatabaseConnection` type export. |
| `services` (prompt) | existing | `src/modules/prompt/services.ts` | Remove module-load `databaseClient.connect()`; wire repos with `databaseClient` (as the client). |
| `DrizzlePromptRepository` | existing | `src/modules/prompt/infrastructure/database/DrizzlePromptRepository.ts` | Constructor takes `DatabaseClientInterface<DatabaseSchema>`; `const db = this.database.getConnection();` at the top of each method; drop `DrizzleDatabaseConnection` import. Own-context table imports unchanged. |
| `DrizzlePromptCategoryRepository` | existing | `src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts` | Same change as above. |
| `DatabaseClient` unit test | existing | `tests/unit/modules/shared/infrastructure/database/DatabaseClient.test.ts` | Rewrite for the new lifecycle (see tasks). |
| Repo integration tests | existing | `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`, `…/DrizzlePromptCategoryRepository.test.ts` | Build a local modules `DatabaseClient` (`new DatabaseClient(config.database, config.database.schema)`) in `beforeAll`, `connect()`, use `getConnection()` for seed helpers, inject the client into the repo, `close()` in `afterAll`. Do **not** use `tests/lib/config.ts`'s instance. |

## 3. Interfaces & contracts

```ts
// DatabaseClientInterface<Schema extends Record<string, unknown> = Record<string, unknown>>
connect(): void;                                              // establish (idempotent, lazy)
getConnection(): DatabaseConnection<NodePgDatabase<Schema>>;  // access; throws if not established
close(): Promise<void>;                                       // release (idempotent no-op)
```

```ts
// DatabaseClient private state
private pool: Pool | undefined;
private connection: DatabaseConnection<NodePgDatabase<Schema>> | undefined;
```

```ts
// services (shared)
import config from '@src/config.js';
export type DatabaseSchema = typeof config.database.schema;
export const databaseClient = new DatabaseClient<DatabaseSchema>(config.database, config.database.schema);
```

Error mapping:

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `DatabaseNotConnectedError` (thrown by `getConnection()`) | Internal error signalling "database connection has not been established"; no HTTP surface of its own — it only occurs on developer misuse (asking for the connection before boot established it). |

## 4. Data & persistence

None. No tables are added or changed and no migration is written. `config.ts`'s
`database.schema` only aggregates references to **existing** table definitions so the
client can bind to them; the tables themselves are unchanged.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | The connection is handed out only after it has been established. | `DatabaseClient.getConnection()` (infrastructure) | → E1 (`DatabaseNotConnectedError`) |

## 6. Dependency changes

none

## 7. Assumptions & risks

Assumptions (trivial, decided silently):
1. `connect()` returns `void` (synchronous) rather than `Promise<void>` — consequence if
   wrong: adding startup connectivity verification later would require widening it to
   async and updating callers. Accepted per spec Decision 2 (lazy establish).
2. `DatabaseNotConnectedError` carries a fixed developer-facing message and no error code;
   consequence if wrong: callers that want to branch on it must use `instanceof` — which
   is the intended usage.
3. The two repo integration tests each construct their own client rather than sharing a
   helper — consequence if wrong: minor duplication across two files; acceptable and
   isolated.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A modules route gets wired into the app without a boot-time `connect()`, so the first request throws E1. | low | med | Documented boot ownership: when modules routes are wired into `app.ts`/`index.ts`, boot must call `databaseClient.connect()` once and `close()` on shutdown. E1 makes the misuse loud rather than silent. |
| R2 | The legacy `@logic/*` client and the modules client each open their own pool (two pools) until the migration completes. | med | low | Out of scope here; noted for the eventual legacy retirement. No regression — this is the pre-existing state. |
| R3 | `config.ts`'s `database.schema` spread silently lets a later-spread module's table overwrite an earlier one exported under the same key. **Already realized**: `legacyPromptSchema` and the modules-side `promptSchema` both export `prompts`/`promptCategories` (two parallel definitions of the same physical tables); since `promptSchema` spreads last, its table objects win for those keys in `config.database.schema` — including for the legacy `DatabaseClient` (`src/logic/shared/services.ts`), which reads the same object. | low | med | Accepted: no code calls Drizzle's relational query API (`db.query.prompts...`) against either client; the only `db.query.*` usage is `db.query.users...` in `DrizzleUserCredentialsRepository`, and `users` is untouched by this collision. Keep table export names unique across contexts where practical; revisit if a future collision isn't inert like this one. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Repeated access after one establish | `connect()` then `getConnection()` ×N | One pool reserved; same connection returned each time | AC1 |
| Access before establish | fresh client, `getConnection()` | Throws `DatabaseNotConnectedError`; no pool created | AC2 |
| Double establish | `connect()` twice | Exactly one pool created | AC3 |
| Access after release | `connect()`, `close()`, `getConnection()` | Throws `DatabaseNotConnectedError` | AC4 |
| Release with nothing established | fresh client, `close()` | Resolves quietly; pool never ended | AC5 |
| Establish after release | `connect()`, `close()`, `connect()`, `getConnection()` | A fresh pool created; access succeeds | AC6 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | §3 `getConnection()` contract; §5 V1 row |
| E1 | §2 `DatabaseNotConnectedError`; §3 error-mapping table |
| AC1 | §2 `DatabaseClient` (memoize); §8 "Repeated access" |
| AC2 | §2 `DatabaseClient`/`DatabaseNotConnectedError`; §8 "Access before establish" |
| AC3 | §2 `DatabaseClient` (idempotent connect); §8 "Double establish" |
| AC4 | §2 `DatabaseClient` (close resets connection); §8 "Access after release" |
| AC5 | §2 `DatabaseClient` (close no-op); §8 "Release with nothing established" |
| AC6 | §2 `DatabaseClient` (fresh pool after close); §8 "Establish after release" |
| Establish-once reuse (story) | §2 repos inject client + `getConnection()`; §2 prompt/shared services rewiring |
| Schema aggregation (story) | §2 `config` (schema aggregation); §2 shared services binding; Decision 5 (spec §6) |
