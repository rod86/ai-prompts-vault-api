# Tasks: Legacy scaffolding cleanup before route/handler migration
Plan: specs/20260711110738-legacy-cleanup/plan.md

<!--
This is a structural cleanup: most tasks are moves/deletions with no unit to test in
isolation, so they follow the logic-less exception — "Red: none — <what> is a
structural/composition change; verified by npm run typecheck && npm run lint && npm test".
The one genuine red→green is the HTTP-surface reduction (T2), anchored by a health/404
integration test. T9 is the whole-repo verification gate.
-->

- [x] T1. Split configuration into `src/config/` and rewire every schema/config consumer
  - Type: infrastructure
  - Depends on: none
  - Red: none — configuration split + composition rewire; verified by `npm run typecheck`.
  - Green: create `src/config/drizzle-schema.ts` (`export default { ...promptSchema,
    ...userSchema }` spread from `@src/modules/{prompt,user}/infrastructure/database/schema.js`)
    and `src/config/config.ts` (env + params, no `schema` key); delete `src/config.ts`.
    Repoint every `@src/config.js` import to `@src/config/config.js`
    (`src/index.ts`, `src/modules/shared/services.ts`, `src/modules/auth/services.ts`, and
    the 4 `tests/integration/modules/**` tests). In `src/modules/shared/services.ts` and
    the 4 module integration tests, source the schema from
    `import schema from '@src/config/drizzle-schema.js'` instead of `config.database.schema`.
  - Covers: AC6 "config is split into an environment/parameters unit and a dedicated
    aggregated-schema unit (default-exported), and every schema consumer reads the schema
    from the dedicated unit"

- [x] T2. Reduce the HTTP surface to the health route only
  - Type: route handler
  - Depends on: T1
  - Red: add `tests/integration/app.test.ts` asserting `GET /health` → `200 {status:'ok'}`
    **and** `GET /prompts` → `404`. Fails now because `/prompts` is still routed.
  - Green: rewrite `src/app.ts` to `express()` + the health route only (no handler/schema/
    middleware imports). Delete `src/handlers/**`, `src/schemas/**`,
    `src/middleware/validateRequest/**` (leaving `src/middleware/` empty → remove), and
    `src/express.d.ts`. Delete the tests that cover them: `tests/integration/handlers/**`
    and `tests/unit/middleware/validateRequest/**`.
  - Covers: AC1 "When a client requests the health check endpoint, Then it responds with a
    success status and an `ok` body"; AC2 "When a client requests a previously-available
    endpoint (e.g. the prompt-list endpoint), Then it receives the not-found response";
    AC5; E1

- [x] T3. Remove the legacy business-logic tree and repoint surviving references
  - Type: infrastructure
  - Depends on: T1, T2
  - Red: none — deletion + import repoint; verified by `npm run typecheck && npm test`.
  - Green: delete `src/logic/**`, `tests/unit/logic/**`, `tests/integration/logic/**`.
    Repoint `src/index.ts` `databaseClient` import to `@src/modules/shared/services.js`.
    In `tests/lib/`: drop the `databaseClient` export + `TestDatabaseConnection` type +
    `DatabaseClient`/`config` imports from `tests/lib/config.ts` (keep the model factories);
    repoint `tests/lib/database/{prompts,users,promptCategories}.ts` and
    `tests/lib/modelFactories/{Prompt,User,PromptCategory}ModelFactory.ts` from `@logic/*`
    to `@src/modules/*`; change `tests/lib/database/users.ts` `db` params from
    `TestDatabaseConnection` to `NodePgDatabase<Record<string, unknown>>`.
  - Covers: AC3 "no legacy business-logic tree remains and nothing imports it"

- [x] T4. Repoint the migration tooling at the modules schema
  - Type: infrastructure
  - Depends on: T3
  - Red: none — build-tooling config; verified by `npx drizzle-kit generate` resolving the
    modules schema with no error (and no `src/logic` reference remaining).
  - Green: set `drizzle.config.ts` `schema` to the two modules schema files
    (`./src/modules/prompt/infrastructure/database/schema.ts`,
    `./src/modules/user/infrastructure/database/schema.ts`).
  - Covers: AC8 "the migration tooling reads the schema from the surviving modules source,
    not the removed legacy tree"

- [ ] T5. Clean tooling configs of legacy references
  - Type: infrastructure
  - Depends on: T3
  - Red: none — tooling config; verified by `npm run lint && npm run typecheck`.
  - Green: remove the `@logic/*` alias from `tsconfig.json`; remove the `src/logic/*`
    element patterns and the `src/logic/shared` shared element from `.eslintrc.json`.
  - Covers: AC7 "the type-check, lint, and full test suite all pass" (tooling portion)

- [ ] T6. Uninstall the request-validation library
  - Type: infrastructure
  - Depends on: T2
  - Red: none — dependency removal; verified by `npm run typecheck` and a grep showing no
    `zod` import remains.
  - Green: `npm uninstall zod` (removes it from `package.json`).
  - Covers: AC4 "the request-validation library is not a dependency and is imported nowhere"

- [ ] T7. Update the project guide documentation
  - Type: infrastructure
  - Depends on: T3, T4, T5, T6
  - Red: none — documentation.
  - Green: edit `CLAUDE.md` to remove references to the legacy `src/logic` tree, the
    `@logic/*` alias, the `zod` library, the `validateRequestMiddleware`/schemas/
    `parsedRequest` validation contract and Zod v4 notes, and the now-deleted example test
    files; keep guidance consistent with the cleaned codebase.
  - Covers: AC9 "the project guide documentation no longer references the removed legacy
    tree, the removed validation library, or the removed validation layer"

- [ ] T8. Delete the old-format spec folders
  - Type: infrastructure
  - Depends on: none
  - Red: none — housekeeping deletion; verified by listing `specs/` (only timestamp-format
    folders remain).
  - Green: delete `specs/001-list-categories` … `specs/009-login` (the nine pre-timestamp
    numbered folders). Leave all `<YMDHMS>-*` folders, including this spec, untouched.
  - Covers: AC10 "the old-format numbered spec folders (`009` and earlier) no longer exist
    and only timestamp-format folders remain"

- [ ] T9. Whole-repo verification gate
  - Type: infrastructure
  - Depends on: T1, T2, T3, T4, T5, T6, T7, T8
  - Red: none — verification step.
  - Green: run `npm run typecheck`, `npm run lint`, `npm test` — all green; grep confirms
    no `src/logic`, no `@logic`, no `zod`, no `validateRequest`, no `src/schemas`,
    no `express.d.ts` references remain.
  - Covers: AC7 "When the type-check, lint, and full test suite are run, Then all three
    pass"

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given the running service, When a client requests the health check endpoint, Then it responds with a success status and an `ok` body. | T2 |
| AC2 | Given the running service, When a client requests a previously-available endpoint (e.g. the prompt-list endpoint), Then it receives the not-found response (covers E1). | T2 |
| AC3 | Given the source and test trees, When they are inspected, Then no legacy business-logic tree remains and nothing imports it. | T3 |
| AC4 | Given the project, When dependencies and source are inspected, Then the request-validation library is not a dependency and is imported nowhere. | T2, T6 |
| AC5 | Given the source tree, When it is inspected, Then the request-validation middleware, its per-endpoint schemas, and the request-augmentation typing no longer exist. | T2 |
| AC6 | Given configuration, When it is inspected, Then it is split into an environment/parameters unit and a dedicated aggregated-schema unit (default-exported), and every schema consumer reads the schema from the dedicated unit. | T1 |
| AC7 | Given the cleaned repository, When the type-check, lint, and full test suite are run, Then all three pass. | T5, T8 |
| AC8 | Given the migration tooling, When it resolves the persistence schema, Then it reads it from the surviving modules source, not the removed legacy tree. | T4 |
| AC9 | Given the project guide documentation, When it is read, Then it no longer references the removed legacy tree, the removed validation library, or the removed validation layer. | T7 |
| AC10 | Given the specs directory, When it is inspected, Then the old-format numbered spec folders (`009` and earlier) no longer exist and only timestamp-format folders remain. | T8 |
