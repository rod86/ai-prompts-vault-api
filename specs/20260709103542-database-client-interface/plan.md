# Plan: Give the shared database connection provider its own contract, with no dedicated composition-root test

Spec: specs/20260709103542-database-client-interface/spec.md

## 1. Approach

In `src/modules/shared` (the canonical location created by the completed
`migrate-shared-to-modules` spec), add a domain contract for the database
connection provider and make its concrete implementation declare it — the same
pattern already used in that same location for `DateTimeInterface`/`DateTimeService`
and `PasswordHasherInterface`/`BcryptPasswordHasher` (confirmed by reading both
files: each class already has an `implements <X>Interface` clause), and now
documented as mandatory for every adapter without exception in the
`domain-driven-design` skill's "Shared cross-cutting ports" section.

Concretely:
- Add `DatabaseClientInterface` (default export, generic over the schema type) under
  `domain/interfaces/`, declaring `connect()`/`close()`.
- Move the `DatabaseConnection<DatabaseSchema>` type alias into that same new file as
  a named export — it's part of the contract's return type, not an implementation
  detail, so it belongs in `domain/`, not `infrastructure/` (the `DatabaseConfig`
  type stays in `infrastructure/`, since it's constructor plumbing, not part of the
  contract's method surface).
- Update `DatabaseClient` to `implements DatabaseClientInterface<DatabaseSchema>`,
  importing `DatabaseConnection` from the new domain file instead of declaring it
  locally.
- Update `services.ts` to type its `databaseClient` export against
  `DatabaseClientInterface<typeof config.database.schema>`. (Read: today none of the
  three exports carry an explicit type annotation — all three are inferred from
  `new X()`. Only `databaseClient` gets one added here, since it's the only one this
  spec's contract covers; `passwordHasher`/`dateTimeService` are untouched, per §1
  "Out of scope".)
- Delete `tests/unit/modules/shared/services.test.ts` (confirmed present; asserts
  `dateTimeService`/`passwordHasher`/`databaseClient` are each `instanceof` their
  concrete class) — per the `domain-driven-design` skill's Testing section,
  wiring/composition files have no logic of their own and get no dedicated test;
  this brings the shared context's `services.ts` in line with that rule (its
  correctness is covered by `tsc` plus the tests of what it composes:
  `tests/unit/modules/shared/infrastructure/DateTimeService.test.ts`,
  `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts`,
  `tests/integration/modules/shared/infrastructure/BcryptPasswordHasher.test.ts`,
  all confirmed present and unaffected).

No behavior changes anywhere: `DatabaseClient`'s constructor and both method bodies
are untouched, and TypeScript's structural typing already made the class assignable
wherever the interface's shape is expected — the `implements` clause and the typed
export are compile-time documentation of intent (and a safety net against future
signature drift), not new runtime behavior.

Legacy `src/logic/shared/database/DatabaseClient.ts` and the prompt/user/auth
business contexts are **not** touched (Decision 3). The already-`IMPLEMENTED`
`migrate-shared-to-modules` spec's files are not reopened (Decisions 1, 5) — this
plan only adds to code that spec already created.

This plan merges and replaces the plans of the two now-deleted source folders
`specs/20260709102334-database-client-interface/` and
`specs/20260709095449-remove-shared-services-test/` (Decisions 7, 8) — the second
plan's entire scope (deleting `services.test.ts`) was already this plan's last
bullet above, so no additional file changes were introduced by the merge; only the
validation/traceability wording was reconciled to name the three specific tests
that prove coverage (from the second plan's §5 V2).

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `DatabaseClientInterface` (port) + `DatabaseConnection` type | new | `src/modules/shared/domain/interfaces/DatabaseClientInterface.ts` | New file: default-exported `DatabaseClientInterface<DatabaseSchema extends Record<string, unknown>>` (`connect()`, `close()`); named-exported `DatabaseConnection<DatabaseSchema>` type alias, moved here verbatim from `infrastructure/DatabaseClient.ts`. |
| `DatabaseClient` (adapter) | existing | `src/modules/shared/infrastructure/DatabaseClient.ts` | Remove the local `DatabaseConnection` type declaration; import `DatabaseClientInterface` (default) and `DatabaseConnection` (named) from the new domain file; add `implements DatabaseClientInterface<DatabaseSchema>` to the class declaration. `DatabaseConfig`, constructor, `connect`/`close` bodies unchanged. |
| `services.ts` (composition root) | existing | `src/modules/shared/services.ts` | Type the `databaseClient` export as `DatabaseClientInterface<typeof config.database.schema>` (import the interface from the new domain file) instead of leaving it inferred as the concrete class. `passwordHasher`/`dateTimeService` exports unchanged. |
| `DatabaseClient` unit test | existing | `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts` | No change — it exercises only `connect`/`close` behavior, unaffected by the type-level changes; imports `DatabaseConfig` from `infrastructure/DatabaseClient.ts`, which is unaffected. |
| `services.ts` composition test | existing → **removed** | `tests/unit/modules/shared/services.test.ts` | Deleted — pure composition has no dedicated test per `domain-driven-design`'s Testing section; AC4/AC5 are proven by `tsc` plus the tests of `DateTimeService`, `BcryptPasswordHasher`, and `DatabaseClient` (T1–T2's/existing tests). |

Legacy files under `src/logic/shared/**` and `tests/**/logic/shared/**`, the
prompt/user/auth contexts, and the `migrate-shared-to-modules` spec folder are **not**
touched. The two now-superseded source spec folders
(`specs/20260709102334-database-client-interface/`,
`specs/20260709095449-remove-shared-services-test/`) are deleted as part of this
planning session (Decision 8) — not a task in `tasks.md`, since it is spec-folder
housekeeping, not part of the shipped feature.

## 3. Interfaces & contracts

- `DatabaseClientInterface<DatabaseSchema extends Record<string, unknown>>` —
  `connect(): DatabaseConnection<DatabaseSchema>`, `close(): Promise<void>` (default
  export).
- `DatabaseConnection<DatabaseSchema extends Record<string, unknown> = Record<string, unknown>>`
  — `NodePgDatabase<DatabaseSchema>` (named export, same file as the interface).
- `DatabaseClient<DatabaseSchema> implements DatabaseClientInterface<DatabaseSchema>`
  — same public surface as today (`connect()`, `close()`), now with an explicit
  `implements` clause.
- `services.ts` — `databaseClient: DatabaseClientInterface<typeof config.database.schema>`
  (previously inferred as the concrete class).

Error mapping: none — this work defines no error responses (spec §4).

| E# | Domain error | Response the user sees |
|--|--|--|
| — | none | none |

## 4. Data & persistence

None. No schema, table, column, or migration changes.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Contract declares the same operations as the concrete provider | `DatabaseClientInterface` definition; `tsc` (the `implements` clause fails to compile if signatures diverge) | — |
| V2 | Contract stated separately from implementation | Directory layout (`domain/interfaces/` vs `infrastructure/`) | — |
| V3 | Provider behavior unchanged | Existing `DatabaseClient.test.ts`, run unmodified | — |
| V4 | Composition entry point refers to the contract, otherwise unchanged | `services.ts`'s type annotation; `tsc`; `git diff` shows only the import + type annotation changed | — |
| V5 | No dedicated test for the composition entry point; coverage preserved by the three wired capabilities' own tests | Absence of `tests/unit/modules/shared/services.test.ts`; `DateTimeService.test.ts`, `DatabaseClient.test.ts`, `BcryptPasswordHasher.test.ts` all pass; `npm run typecheck` | — |
| V6 | Legacy copy and business areas unchanged | `git diff` shows no changes under `src/logic/**` or its tests; existing suite stays green | — |
| V7 | Original relocation work's own record untouched | `git diff` shows no changes under `specs/20260709091827-migrate-shared-to-modules/` | — |
| V8 | Quality gates pass | `npm run lint`, `npm run typecheck`, `npm test` | — |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. `DatabaseConfig` stays in `infrastructure/DatabaseClient.ts` rather than moving to
   the domain file — it's the constructor's plumbing shape (host/port/user/password/
   database), not part of the contract's method surface — consequence if wrong: it
   would need to move alongside `DatabaseConnection`, but nothing else changes.
2. The new domain file is named `DatabaseClientInterface.ts` (matching the class name
   `DatabaseClient` + the project's `<Domain><Role>Interface` naming convention),
   consistent with `DateTimeInterface.ts`/`PasswordHasherInterface.ts` already in the
   same folder — consequence if wrong: only the file/type name would differ.
3. No new unit test is added asserting `implements` conformance — TypeScript's
   `implements` clause is itself a compile-time check (`tsc` fails to build if the
   class doesn't satisfy the interface), so a runtime test would assert nothing the
   type system doesn't already guarantee — consequence if wrong: negligible, since
   `tsc` already covers this on every `npm run typecheck`/`npm test` run.
4. The merged spec keeps the slug `database-client-interface` (rather than a new
   compound name) since that source plan's scope is the superset — consequence if
   wrong: only the folder name would differ, no effect on delivered behavior.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Removing `services.test.ts` silently drops real coverage if `services.ts` ever grows actual logic later | low | low | The `domain-driven-design` skill's "no logic, no test" rule already flags this smell ("an adapter with real branching logic... is application logic in disguise — move it into a use case"); if `services.ts` ever does more than instantiate/export, that's the signal to add a test back, not a reason to keep one now. |
| R2 | An earlier attempt to remove this same test file (commit `f555332`) was reverted (commit `4a725bd`) because it edited the already-`IMPLEMENTED` `migrate-shared-to-modules` spec's `plan.md`/`tasks.md` directly, violating the immutability hard rule — not because removing the test itself was wrong | n/a | n/a | This plan achieves the same test removal through a brand-new (now merged) spec folder instead of reopening the implemented one, which is the correct path per the hard rule. |

## 8. Edge cases

Behavioral edge cases are unchanged from the original relocation spec and remain
covered by the existing, untouched `DatabaseClient.test.ts`:

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Reuse connection | `connect()` called twice | A single pool is created and reused | AC2 |
| Reconnect after close | `connect()`, `close()`, `connect()` | A fresh pool is created after close | AC2 |
| Close with no open connection | `close()` before any `connect()` | Safe no-op, resolves undefined, pool never ended | AC2 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | `DatabaseClientInterface` file; §5 V1 |
| V2 | Domain/infrastructure layer placement; §5 V2 |
| V3 | Existing `DatabaseClient.test.ts`, unmodified; §5 V3 |
| V4 | `services.ts` typed export; §5 V4 |
| V5 | Deleted `services.test.ts`; three wired-capability tests; §5 V5 |
| V6 | §1 "left unchanged"; §5 V6 (`git diff`) |
| V7 | §1 "not reopened"; §5 V7 (`git diff`) |
| V8 | §5 V8 (lint/typecheck/test) |
| AC1 | `DatabaseClientInterface` file (§2) |
| AC2 | `DatabaseClient` `implements` change (§2); §8 edge cases; existing test |
| AC3 | `services.ts` typed export (§2) |
| AC4 | `services.test.ts` deletion (§2) |
| AC5 | Three wired-capability tests + `tsc` (§5 V5) |
| AC6 | §1 scope; §5 V6 |
| AC7 | §1 scope; §5 V7 |
| AC8 | §5 V8 |
