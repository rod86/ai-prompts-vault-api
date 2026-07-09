# Tasks: Give the shared database connection provider its own contract
Plan: specs/20260709102334-database-client-interface/plan.md

- [ ] T1. Add the database connection provider's contract
  - Type: domain
  - Depends on: none
  - Red: none — this introduces only a type-level contract (an interface plus a type
    alias), no runtime logic of its own; per `testing-practices`/`domain-driven-design`,
    a domain contract gets no dedicated test, and TypeScript's structural typing means
    no assignment would fail to compile with or without it. Verified by `npm run
    typecheck` succeeding once the file exists.
  - Green: create `src/modules/shared/domain/interfaces/DatabaseClientInterface.ts` —
    default-exported `DatabaseClientInterface<DatabaseSchema extends Record<string, unknown>>`
    (`connect(): DatabaseConnection<DatabaseSchema>`, `close(): Promise<void>`), plus
    the `DatabaseConnection<DatabaseSchema>` type alias as a named export, moved here
    verbatim from `src/modules/shared/infrastructure/DatabaseClient.ts`.
  - Covers: AC1 "Given the new canonical location, When the database connection
    provider's contract is inspected, Then it declares the same operations (open a
    connection bound to a supplied structure, close it) as the concrete provider.";
    V1, V2

- [ ] T2. Make DatabaseClient implement its contract
  - Type: infrastructure
  - Depends on: T1
  - Red: none — TypeScript's structural typing already makes `DatabaseClient`
    assignable wherever `DatabaseClientInterface` is expected, with or without an
    explicit `implements` clause, so there is no failing type-check or test to drive
    here; declaring `implements` is compile-time documentation of intent (and a
    safety net against future signature drift), not new behavior. Verified by the
    existing `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts`
    continuing to pass unmodified (proves behavior is unchanged) and `npm run
    typecheck` succeeding.
  - Green: update `src/modules/shared/infrastructure/DatabaseClient.ts` — delete its
    local `DatabaseConnection` type declaration, import `DatabaseClientInterface`
    (default) and `DatabaseConnection` (named) from
    `../domain/interfaces/DatabaseClientInterface.js`, and add `implements
    DatabaseClientInterface<DatabaseSchema>` to the class declaration. `DatabaseConfig`,
    the constructor, and the `connect`/`close` bodies are unchanged.
  - Covers: AC2 "Given the contract is in place, When the provider is opened, reused,
    and closed, Then it opens a single reusable connection bound to the supplied
    structure, closes it on request, and is a safe no-op when closed without an open
    connection — exactly as before."; V1, V2, V3

- [ ] T3. Compose the provider through its contract
  - Type: infrastructure
  - Depends on: T2
  - Red: none — same structural-typing reasoning as T2: annotating the export's type
    is a compile-time-only change with no new runtime behavior, so no test can fail
    beforehand. Verified by `npm run typecheck` succeeding.
  - Green: update `src/modules/shared/services.ts` — import `DatabaseClientInterface`
    from the new domain file and type the `databaseClient` export as
    `DatabaseClientInterface<typeof config.database.schema>` instead of leaving it
    inferred as the concrete `DatabaseClient` class.
  - Covers: AC3 "Given the single composition entry point, When it exposes the
    database connection provider, Then it is described in terms of the contract
    rather than the concrete implementation."; V4

- [ ] T4. Remove the composition entry point's own test
  - Type: infrastructure
  - Depends on: T3
  - Red: none — this task deletes a test rather than adding one; there is nothing to
    fail first. Per `domain-driven-design`'s Testing section, `services.ts` is pure
    composition with no logic of its own, so it gets no dedicated test — its
    correctness is proven by `tsc` plus the tests of `DateTimeService`,
    `BcryptPasswordHasher`, and `DatabaseClient` that it wires together.
  - Green: delete `tests/unit/modules/shared/services.test.ts`.
  - Covers: AC4 "Given the composition entry point holds no logic of its own, When
    its test suite is inspected, Then it has no dedicated test file — its
    correctness is proven by type-checking and by the tests of the capabilities it
    composes."; V5

- [ ] T5. Verify legacy is untouched and all quality gates pass
  - Type: tooling
  - Depends on: T1, T2, T3, T4
  - Red: `git diff` would show unexpected changes under `src/logic/**` or its tests,
    or under the `migrate-shared-to-modules` spec folder, if any leaked in — none are
    expected since this task only checks.
  - Green: run `npm run lint`, `npm run typecheck`, and `npm test`; confirm all pass;
    confirm `git diff` shows no changes under `src/logic/**`, `tests/**/logic/**`, or
    `specs/20260709091827-migrate-shared-to-modules/**`.
  - Covers: AC5 "Given the change is complete, When the legacy copy of the provider
    and the existing business areas are inspected, Then they are unchanged and their
    tests still pass."; AC6 "Given the change is complete, When the project's lint,
    type-check, and full test suite are run, Then all pass."; V6, V7

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | *Contract stated.* Given the new canonical location, When the database connection provider's contract is inspected, Then it declares the same operations (open a connection bound to a supplied structure, close it) as the concrete provider. | T1 |
| AC2 | *Behavior unchanged.* Given the contract is in place, When the provider is opened, reused, and closed, Then it opens a single reusable connection bound to the supplied structure, closes it on request, and is a safe no-op when closed without an open connection — exactly as before. | T2 |
| AC3 | *Composition refers to the contract.* Given the single composition entry point, When it exposes the database connection provider, Then it is described in terms of the contract rather than the concrete implementation. | T3 |
| AC4 | *No dedicated test for pure composition.* Given the composition entry point holds no logic of its own, When its test suite is inspected, Then it has no dedicated test file — its correctness is proven by type-checking and by the tests of the capabilities it composes. | T4 |
| AC5 | *Legacy left intact.* Given the change is complete, When the legacy copy of the provider and the existing business areas are inspected, Then they are unchanged and their tests still pass. | T5 |
| AC6 | *Quality gates pass.* Given the change is complete, When the project's lint, type-check, and full test suite are run, Then all pass. | T5 |
