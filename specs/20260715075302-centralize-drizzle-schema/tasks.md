# Tasks: Centralize Drizzle schema out of bounded contexts
Plan: specs/20260715075302-centralize-drizzle-schema/plan.md

<!--
This is a behavior-neutral refactor: no new behavior, so no new failing test is
written. Tasks are either (a) logic-less composition/config/tooling files whose
Red is "none" per testing-practices, or (b) behavior-preserving repository edits
guarded by an EXISTING integration test that must stay green. Order keeps the
build compiling and the suite green at every task boundary: new files are added
first, each context is migrated atomically (repo + its services wiring together),
consumers are repointed, and only then are the old files and the boundary
exception removed.
-->

- [ ] T1. Central schema files + barrel
  - Type: infrastructure
  - Depends on: none
  - Red: none — `user.schema.ts`, `prompt.schema.ts`, and `index.ts` are pure
    schema definitions / composition (see testing-practices); the old files
    remain so the suite stays green. Go straight to Green.
  - Green: create `src/config/drizzle/user.schema.ts` (`users`, verbatim),
    `src/config/drizzle/prompt.schema.ts` (`promptCategories`, `prompts`; FK
    `users` imported from `./user.schema.js`), and `src/config/drizzle/index.ts`
    exporting `const schema = { ...userSchema, ...promptSchema }` plus types
    `DatabaseSchema`, `DatabaseConnection`, `PromptSchema`, and `UserSchema`
    (shared by the user and auth contexts; no separate `AuthSchema` — D10).
  - Covers: AC3 "any code outside that location imports the schema … only through the single entry point"

- [ ] T2. Repoint drizzle-kit config; prove no migration
  - Type: infrastructure
  - Depends on: T1
  - Red: none — config-only change; verification is the migration diff.
  - Green: set `drizzle.config.ts` `schema:` to
    `['./src/config/drizzle/user.schema.ts', './src/config/drizzle/prompt.schema.ts']`,
    then run `npx drizzle-kit generate` and confirm it reports **no** pending
    changes.
  - Covers: AC7 "the migration generator … produces no new migration"

- [ ] T3. Migrate prompt context onto injected schema
  - Type: infrastructure
  - Depends on: T1
  - Red: none — behavior-preserving; guarded by existing
    `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`
    and `DrizzlePromptCategoryRepository.test.ts`, which must stay green.
  - Green: add a `schema: PromptSchema` constructor param to
    `DrizzlePromptRepository` and `DrizzlePromptCategoryRepository`; destructure
    the needed tables at the top of each method (query bodies verbatim); import
    `DatabaseConnection` from the barrel; wire `schema` into both repos in
    `src/modules/prompt/services.ts`; pass `schema` to the repo constructors in
    the two repository tests.
  - Covers: AC4 "it receives its schema through construction and contains no direct import of schema definitions"; AC1 "imports no schema definition belonging to another bounded context"

- [ ] T4. Migrate user context onto injected schema
  - Type: infrastructure
  - Depends on: T1
  - Red: none — behavior-preserving; guarded by existing
    `tests/integration/modules/user/infrastructure/database/DrizzleUserRepository.test.ts`.
  - Green: add `schema: UserSchema` to `DrizzleUserRepository`, destructure
    `users` per method; import `DatabaseConnection` from the barrel; wire `schema`
    in `src/modules/user/services.ts`; pass `schema` in the repository test.
  - Covers: AC4 "it receives its schema through construction and contains no direct import of schema definitions"

- [ ] T5. Migrate + dedupe auth context
  - Type: infrastructure
  - Depends on: T1
  - Red: none — behavior-preserving; guarded by existing
    `tests/integration/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.test.ts`
    and `tests/integration/handlers/auth/authenticateHandler.test.ts`.
  - Green: add `schema: UserSchema` to `DrizzleUserCredentialsRepository`,
    destructure the shared `users` per method; wire `schema` in
    `src/modules/auth/services.ts`; pass `schema` in the repository test; delete
    `src/modules/auth/infrastructure/database/schema.ts` (the duplicate `users`).
  - Covers: AC2 "that record is defined exactly once and every context that uses it shares that single definition"; AC4 "it receives its schema through construction and contains no direct import of schema definitions"

- [ ] T6. Repoint tests to the barrel
  - Type: infrastructure
  - Depends on: T1, T3, T4, T5
  - Red: none — test-infrastructure repoint; the suite must stay green.
  - Green: in `tests/lib/database/{prompts,users,promptCategories}.ts` and the 12
    `tests/integration/**` files, import `{ schema }` and
    `DatabaseSchema`/`DatabaseConnection` from `@src/config/drizzle/index.js`;
    access tables as `schema.<table>`.
  - Covers: AC6 "all existing tests pass and the type-check is clean"

- [ ] T7. Repoint shared services to the barrel
  - Type: infrastructure
  - Depends on: T1, T3, T4, T5, T6
  - Red: none — logic-less composition root (see testing-practices).
  - Green: in `src/modules/shared/services.ts` import `schema`/`DatabaseSchema`
    from `@src/config/drizzle/index.js`; remove its local `DatabaseSchema` and
    `DatabaseConnection` exports.
  - Covers: AC3 "any code outside that location imports the schema … only through the single entry point"

- [ ] T8. Remove the old schema files
  - Type: infrastructure
  - Depends on: T2, T3, T4, T6, T7
  - Red: none — deletion of now-unreferenced files; type-check/lint/tests guard it.
  - Green: delete `src/modules/prompt/infrastructure/database/schema.ts`,
    `src/modules/user/infrastructure/database/schema.ts`, and
    `src/config/drizzle-schema.ts`; run `npm run typecheck`, `npm run lint`,
    `npm test` — all pass.
  - Covers: AC1 "imports no schema definition belonging to another bounded context"

- [ ] T9. Remove the cross-context boundary exception
  - Type: infrastructure
  - Depends on: T8
  - Red: none — tooling change; verification is `npm run lint`.
  - Green: in `.eslintrc.json` remove the `schema` element from
    `boundaries/elements`, the standalone `from: schema → to: schema` rule, and
    the `to: schema` allowance in the infrastructure rule; run `npm run lint` —
    it passes with no cross-context violation.
  - Covers: AC5 "the cross-context schema exception is absent and the lint passes"

- [ ] T10. Final verification gate
  - Type: infrastructure
  - Depends on: T9
  - Red: none — whole-suite verification.
  - Green: run `npm run typecheck`, `npm run lint`, `npm test`, and
    `npx drizzle-kit generate`; confirm all pass and no pending migration is
    produced.
  - Covers: AC6 "all existing tests pass and the type-check is clean"; AC7 "the migration generator … produces no new migration"

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given any bounded context's persistence code, When its imports are inspected, Then it imports no schema definition belonging to another bounded context. | T3, T5, T8, T9 |
| AC2 | Given the record that was previously defined in two contexts, When the centralized schema is inspected, Then that record is defined exactly once and every context that uses it shares that single definition. | T1, T5 |
| AC3 | Given the centralized schema location, When any code outside that location imports the schema, Then it imports only through the single entry point (never a per-context schema file directly). | T1, T7, T8 |
| AC4 | Given a repository, When it is constructed, Then it receives its schema through construction and contains no direct import of schema definitions. | T3, T4, T5 |
| AC5 | Given the boundary-checking tooling, When the linter runs, Then the cross-context schema exception is absent and the lint passes. | T9 |
| AC6 | Given the completed change, When the full test suite and the type-check run, Then all existing tests pass and the type-check is clean, with no change to existing behavior. | T3, T4, T5, T6, T7, T10 |
| AC7 | Given the completed change, When the migration generator runs against the centralized schema, Then no new migration is produced (the database-level schema is identical to before). | T2, T10 |
