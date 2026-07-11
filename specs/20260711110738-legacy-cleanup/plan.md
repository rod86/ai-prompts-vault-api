# Plan: Legacy scaffolding cleanup before route/handler migration
Spec: specs/20260711110738-legacy-cleanup/spec.md

## 1. Approach

A pure structural cleanup — no runtime feature. Five coordinated moves:

1. **Split configuration.** Turn `src/config.ts` into a folder `src/config/` with two
   files: `config.ts` (environment values + fixed params, no schema) and
   `drizzle-schema.ts` (the aggregated Drizzle schema, **default-exported**, spread from
   the surviving **modules** schema files only). Repoint every `@src/config.js` importer
   to `@src/config/config.js`, and repoint every consumer of the old
   `config.database.schema` to `import schema from '@src/config/drizzle-schema.js'`.
2. **Collapse the HTTP surface to health only.** Rewrite `src/app.ts` to mount just the
   health route; delete all handlers, all per-handler validation schemas, the validation
   middleware, and the request-augmentation typing.
3. **Delete the legacy business-logic tree** (`src/logic/**`) and every test that targets
   it (`tests/unit/logic/**`, `tests/integration/logic/**`, `tests/integration/handlers/**`,
   `tests/unit/middleware/**`). Repoint the surviving shared test support
   (`tests/lib/**`) and `src/index.ts` from `@logic/*` to `@src/modules/*`.
4. **Fix tooling** so it points at the modules tree: `drizzle.config.ts` schema glob, the
   `@logic/*` path alias in `tsconfig.json`, and the `src/logic/*` element patterns in the
   eslint boundaries config. Uninstall the `zod` dependency.
5. **Update `CLAUDE.md`** to drop the now-removed legacy tree, `@logic/*` alias, validation
   library, validation-layer contract, and deleted example-test citations.

The set of database tables is unchanged, so **no migration is generated or applied**. The
aggregated schema keeps the same three tables (`prompt_categories`, `prompts`, `users`)
— it just sources them from the modules schema files instead of the legacy ones.

Reused patterns: the modules `DatabaseClient`
(`src/modules/shared/infrastructure/database/DatabaseClient.ts`, `connect()` + `getConnection()`),
the modules `services.ts` composition roots, and the existing modules schema files
(`src/modules/{prompt,user}/infrastructure/database/schema.ts`).

## 2. Components & modules

### Add

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Config (env/params) | new | `src/config/config.ts` | Env + fixed params (`port`, `environment`, `jwtSecret`, `jwtExpirationSeconds`, `database` credentials). **No `schema` key.** |
| Aggregated schema | new | `src/config/drizzle-schema.ts` | `export default { ...promptSchema, ...userSchema }` spread from the two modules schema files; tables `prompt_categories`, `prompts`, `users`. |
| Health/routing test | new | `tests/integration/app.test.ts` | `GET /health` → 200 `{status:'ok'}`; `GET /prompts` → 404. |

### Edit

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| HTTP app | existing | `src/app.ts` | Reduce to `express()` + the health route only; drop all handler/schema/middleware imports and routes. |
| Server bootstrap | existing | `src/index.ts` | Import `config` from `@src/config/config.js`; import `databaseClient` from `@src/modules/shared/services.js` (was `@logic/shared/services.js`). |
| Modules shared services | existing | `src/modules/shared/services.ts` | `import schema from '@src/config/drizzle-schema.js'`; `DatabaseSchema = typeof schema`; construct `databaseClient` with `config.database` + `schema`; `config` path → `@src/config/config.js`. |
| Modules auth services | existing | `src/modules/auth/services.ts` | `config` import path → `@src/config/config.js`. |
| Test support: config | existing | `tests/lib/config.ts` | Drop the `databaseClient` export, `TestDatabaseConnection` type, and the `DatabaseClient`/`config` imports (only deleted tests used them). Keep the three model-factory exports. |
| Test support: user db helper | existing | `tests/lib/database/users.ts` | Repoint `users` schema + `User` type to `@src/modules/user/...`; change `db` param type from `TestDatabaseConnection` to `NodePgDatabase<Record<string, unknown>>` (matching the prompt/category helpers). |
| Test support: prompt db helper | existing | `tests/lib/database/prompts.ts` | Repoint `prompts` schema to `@src/modules/prompt/...`. |
| Test support: category db helper | existing | `tests/lib/database/promptCategories.ts` | Repoint `promptCategories` schema + `PromptCategory` type to `@src/modules/prompt/...`. |
| Test support: model factories | existing | `tests/lib/modelFactories/{Prompt,User,PromptCategory}ModelFactory.ts` | Repoint the domain type imports from `@logic/*` to `@src/modules/*`. |
| Module integration tests | existing | `tests/integration/modules/**/*.test.ts` (4 files) | `config` path → `@src/config/config.js`; source the schema value from `@src/config/drizzle-schema.js` instead of `config.database.schema`. |
| Drizzle config | existing | `drizzle.config.ts` | `schema` → the two modules schema files (`./src/modules/prompt/infrastructure/database/schema.ts`, `./src/modules/user/infrastructure/database/schema.ts`). |
| TS config | existing | `tsconfig.json` | Remove the `@logic/*` path alias. |
| Eslint boundaries | existing | `.eslintrc.json` | Remove the `src/logic/*` element patterns and the `src/logic/shared` shared element. |
| Package manifest | existing | `package.json` | Remove the `zod` dependency. |
| Project guide | existing | `CLAUDE.md` | Remove legacy-tree / `@logic/*` / validation-library / validation-layer / deleted-example references (AC9). |

### Remove

| Path | Why |
| ---- | --- |
| `src/logic/**` (entire tree) | Legacy business-logic contexts (auth, prompt, user, shared) fully superseded by `src/modules/**`. |
| `src/config.ts` | Replaced by the `src/config/` folder. |
| `src/handlers/**` (8 files) | All HTTP handlers removed (health stays inline in `app.ts`). |
| `src/schemas/**` (7 files) | Per-handler validation schemas — removed with the validation layer. |
| `src/middleware/validateRequest/**` (`validateRequestMiddleware.ts`, `validation.ts`) | The request-validation middleware and its helper; leaves `src/middleware/` empty → remove. |
| `src/express.d.ts` | Ambient `req.parsedRequest` augmentation; only the validation layer used it. |
| `tests/integration/handlers/**` (8 files) | Cover deleted handlers. |
| `tests/unit/middleware/validateRequest/**` (2 files) | Cover deleted middleware/validation. |
| `tests/unit/logic/**`, `tests/integration/logic/**` | Cover the deleted legacy tree. |
| `specs/001-list-categories` … `specs/009-login` (9 folders) | Old pre-timestamp numbered spec format; removed so they don't interfere with future planning. Timestamp-format folders are kept. |

## 3. Interfaces & contracts

- `src/config/drizzle-schema.ts`: `export default { ...promptSchema, ...userSchema }` →
  an object of Drizzle tables (`promptCategories`, `prompts`, `users`).
- `src/config/config.ts`: `export default { port, environment, jwtSecret,
  jwtExpirationSeconds, database: { host, port, user, password, database } }`.
- `src/modules/shared/services.ts`: `export type DatabaseSchema = typeof schema` and
  `export const databaseClient = new DatabaseClient<DatabaseSchema>(config.database, schema)`.
- `src/app.ts`: an Express app exposing only `GET /health` → `200 { status: 'ok' }`.

Error mapping:

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | none (no route matched) | The framework default 404 not-found response |

## 4. Data & persistence

None. No table is added, changed, or dropped; no migration is generated or run. The
aggregated schema resolves to the same three tables as before, only sourced from the
modules schema files.

- Migration: none.
- Rollback: n/a.
- Mapping: unchanged.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| — | none | — | — |

No validation rules exist in this spec; the request-validation layer is being removed.

## 6. Dependency changes

| Dependency | Version | Action | Reason |
|--|--|--|--|
| zod | ^4.4.3 | uninstall | Request-validation library; the validation layer that used it is removed. |

## 7. Assumptions & risks

Assumptions:
1. The aggregated schema spreads only the **modules** `prompt` + `user` schema files (not
   the `auth` schema file, which is a byte-identical duplicate of the `user` schema and
   would collide on the `users` key) — consequence if wrong: a duplicate-table error at
   schema build. The `auth` module keeps its own schema file for its repository import; it
   is simply not aggregated.
2. `src/index.ts` keeps connecting the database on boot (now via the modules
   `databaseClient`) even though no surviving route touches the DB — consequence if wrong:
   at most an unnecessary boot-time DB connection; preserves current boot behavior and is
   re-used when routes are migrated back.
3. `src/app.ts` drops the JSON body-parser along with the routes (no surviving route reads
   a body) — consequence if wrong: a future body route must re-add it, which the
   route/handler migration does anyway.
4. `drizzle.config.ts` lists the two modules schema files explicitly rather than a
   `src/modules/*` glob, to avoid pulling in the duplicate `auth` `users` table —
   consequence if wrong: `drizzle-kit generate` errors on a duplicate table.
5. No `config` element is added to the eslint boundaries config — the config folder stays
   an "unknown" boundaries element (as `src/config.ts` was), so `shared`→config imports
   keep passing — consequence if wrong: adding a `config` element would newly disallow the
   existing `shared`→config import and break lint.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A surviving file still imports a removed `@logic/*` path and typecheck/lint fails | med | build breaks | The final verify task runs `typecheck` + `lint` + full suite and greps for `@logic`, `zod`, `validateRequest`. |
| R2 | Modules domain type shape differs from the legacy type the test factories used | low | test typecheck breaks | Confirmed during exploration: modules `Prompt`/`User`/`PromptCategory` shapes match what the factories/helpers consume. |
| R3 | `drizzle.config.ts` schema path left pointing at deleted `src/logic/*` | low | migration generation breaks | AC8 + a dedicated task repoint it to the modules schema files. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Health still works | `GET /health` | `200 { status: 'ok' }` | AC1 |
| Removed route | `GET /prompts` | `404` (default not-found) | AC2, E1 |
| Removed auth route | `POST /authenticate` | `404` | AC2 |
| Schema still resolves three tables | app boot / repo query | `prompt_categories`, `prompts`, `users` present in the connection schema | AC6, AC7 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| AC1 (health works) | `src/app.ts` health route; `tests/integration/app.test.ts` |
| AC2 / E1 (removed routes → 404) | `src/app.ts` reduced; handler/schema/middleware removals; `tests/integration/app.test.ts` |
| AC3 (no legacy tree) | Remove `src/logic/**` + logic tests; repoint `tests/lib/**` + `src/index.ts` to `@src/modules/*` |
| AC4 (no zod) | Remove schemas/middleware/`validation.ts`; §6 uninstall `zod` |
| AC5 (no validation layer) | Remove `src/middleware/validateRequest/**`, `src/schemas/**`, `src/express.d.ts` |
| AC6 (config split) | Add `src/config/config.ts` + `src/config/drizzle-schema.ts`; rewire `modules/shared/services.ts`, module integration tests, `tests/lib` |
| AC7 (typecheck+lint+suite pass) | All edits; `tsconfig.json` + `.eslintrc.json` fixes; final verify task |
| AC8 (tooling reads modules schema) | `drizzle.config.ts` schema path repoint |
| AC9 (docs updated) | `CLAUDE.md` edits |
| AC10 (old spec folders removed) | Delete `specs/001-*` … `specs/009-login` |
