# Tasks: Migrate shared cross-cutting capabilities to the new module structure
Plan: specs/20260709091827-migrate-shared-to-modules/plan.md

- [x] T1. Relocate the current-time provider
  - Type: infrastructure
  - Depends on: none
  - Red: add `tests/unit/modules/shared/infrastructure/DateTimeService.test.ts` (mirror of the legacy `DateTimeService` unit test) importing `DateTimeService` from `@src/modules/shared/infrastructure/DateTimeService.js`; it asserts `now()` returns a `Date` between a `before` and `after` timestamp. Fails: module not found.
  - Green: create `src/modules/shared/domain/interfaces/DateTimeInterface.ts` (`now(): Date`, default export) and `src/modules/shared/infrastructure/DateTimeService.ts` (`class DateTimeService implements DateTimeInterface`), copied from legacy with the import re-pointed to the new interface path.
  - Covers: AC1 "Given the new canonical location, When the current-time provider is asked for the time, Then it returns the present moment, exactly as the legacy provider does"; V1, V2

- [x] T2. Relocate the database connection provider
  - Type: infrastructure
  - Depends on: none
  - Red: add `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts` (mirror of the legacy `DatabaseClient` unit test, with `pg` and `drizzle-orm/node-postgres` mocked) importing `DatabaseClient`/`DatabaseConfig` from `@src/modules/shared/infrastructure/DatabaseClient.js`; asserts it opens a pool bound to the schema, reuses one pool across `connect()` calls, ends the pool on `close()`, builds a fresh pool after close, and is a no-op closing with no open connection. Fails: module not found.
  - Green: create `src/modules/shared/infrastructure/DatabaseClient.ts` (default-export `DatabaseClient<DatabaseSchema>` plus named `DatabaseConfig` and `DatabaseConnection` types), copied verbatim from legacy `database/DatabaseClient.ts`.
  - Covers: AC2 "Given the new canonical location, When the database connection provider is opened, reused, and closed, Then it opens a single reusable connection bound to the supplied schema, closes it on request, and is a safe no-op when closed without an open connection — exactly as the legacy provider does"; V1, V2

- [x] T3. Relocate the password hasher
  - Type: infrastructure
  - Depends on: none
  - Red: add `tests/integration/modules/shared/infrastructure/BcryptPasswordHasher.test.ts` (mirror of the legacy `BcryptPasswordHasher` integration test) importing `BcryptPasswordHasher` from `@src/modules/shared/infrastructure/BcryptPasswordHasher.js`; asserts a hash is never the plaintext and verifies true, `compare` is true for a matching password and false for a non-matching one. Fails: module not found.
  - Green: create `src/modules/shared/domain/interfaces/PasswordHasherInterface.ts` (`hash`, `compare`, default export) and `src/modules/shared/infrastructure/BcryptPasswordHasher.ts` (`class BcryptPasswordHasher implements PasswordHasherInterface`, 10 salt rounds), copied from legacy with the import re-pointed and flattened out of `security/`.
  - Covers: AC3 "Given the new canonical location, When a password is hashed and then compared, Then the hash is never the plaintext, a matching password compares true, and a non-matching password compares false — exactly as the legacy hasher does"; V1, V2

- [x] T4. Add the shared composition entry point
  - Type: infrastructure
  - Depends on: T1, T2, T3
  - Red: none — `services.ts` is a pure composition root (no logic of its own); per
    `testing-practices`/`domain-driven-design`, proven by `tsc` and by the tests of the
    pieces it wires (T1–T3), not a dedicated test.
  - Green: create `src/modules/shared/services.ts` exporting the three singletons (`databaseClient` built from `@src/config` database config + schema, `passwordHasher`, `dateTimeService`), copied from legacy with imports re-pointed to the new adapter paths.
  - Covers: AC4 "Given the new canonical location, When the shared composition entry point is loaded, Then it exposes ready-to-use instances of the current-time provider, the password hasher, and the database connection provider"; V1

- [x] T5. Register the new folder with the architecture-boundary tooling and verify all gates
  - Type: tooling
  - Depends on: T1, T2, T3, T4
  - Red: `npm run lint` does not recognize `src/modules/shared` as a bounded element (no `shared` element matches the new path).
  - Green: add a second element `{ "type": "shared", "pattern": "src/modules/shared", "mode": "folder" }` to `boundaries/elements` in `.eslintrc.json` (leaving the existing legacy entry intact); then confirm `npm run lint`, `npm run typecheck`, and `npm test` all pass, and `git diff` shows no changes under `src/logic/**` or the legacy tests.
  - Covers: AC5 "Given the migration is complete, When the legacy copy and the existing business areas are inspected, Then they are unchanged and their tests still pass"; AC6 "Given the migration is complete, When the project's lint, type-check, and full test suite are run, Then all pass"; V2, V3, V4

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | *Current-time provider relocated.* Given the new canonical location, When the current-time provider is asked for the time, Then it returns the present moment, exactly as the legacy provider does. | T1 |
| AC2 | *Database connection provider relocated.* Given the new canonical location, When the database connection provider is opened, reused, and closed, Then it opens a single reusable connection bound to the supplied schema, closes it on request, and is a safe no-op when closed without an open connection — exactly as the legacy provider does. | T2 |
| AC3 | *Password hasher relocated.* Given the new canonical location, When a password is hashed and then compared, Then the hash is never the plaintext, a matching password compares true, and a non-matching password compares false — exactly as the legacy hasher does. | T3 |
| AC4 | *Single composition entry point.* Given the new canonical location, When the shared composition entry point is loaded, Then it exposes ready-to-use instances of the current-time provider, the password hasher, and the database connection provider. | T4 (no dedicated test — proven by `tsc` + T1–T3's tests) |
| AC5 | *Legacy left intact.* Given the migration is complete, When the legacy copy and the existing business areas are inspected, Then they are unchanged and their tests still pass. | T5 |
| AC6 | *Quality gates pass.* Given the migration is complete, When the project's lint, type-check, and full test suite are run, Then all pass. | T5 |