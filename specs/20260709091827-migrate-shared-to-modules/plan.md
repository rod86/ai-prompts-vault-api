# Plan: Migrate shared cross-cutting capabilities to the new module structure
Spec: specs/20260709091827-migrate-shared-to-modules/spec.md

## 1. Approach

Create a new canonical shared context at `src/modules/shared/` following the
`domain-driven-design` skill's structure, by **copying** the three legacy capabilities
into the correct layer folders with their existing names preserved:

- Contracts (ports) go under `src/modules/shared/domain/interfaces/`.
- Concrete adapters go **flat** under `src/modules/shared/infrastructure/` (no
  `security/`, `database/`, or `utils/` subfolders — the guideline places shared adapters
  directly under `infrastructure/`).
- A single `src/modules/shared/services.ts` composition root instantiates and exports the
  three singletons.

The legacy `src/logic/shared/` and the prompt/user/auth business contexts are left
**byte-for-byte unchanged** (Decision 3). The new context is not yet wired into any
business area — it is the foundation for later context migrations. The only cross-cutting
tooling change is registering the new folder with `eslint-plugin-boundaries` so the
architecture rules recognize it.

New tests are authored at the mirrored `tests/**/modules/shared/**` paths, copied from the
legacy tests and re-pointed to the new import paths (the `@src/modules/shared/...` alias
form per CLAUDE.md). Each is written **before** the file it exercises (test-first).

Reused verbatim from legacy (same code, new path):
- `src/logic/shared/utils/DateTimeInterface.ts` → `src/modules/shared/domain/interfaces/DateTimeInterface.ts`
- `src/logic/shared/utils/DateTimeService.ts` → `src/modules/shared/infrastructure/DateTimeService.ts`
- `src/logic/shared/domain/interfaces/PasswordHasherInterface.ts` → `src/modules/shared/domain/interfaces/PasswordHasherInterface.ts`
- `src/logic/shared/infrastructure/security/BcryptPasswordHasher.ts` → `src/modules/shared/infrastructure/BcryptPasswordHasher.ts`
- `src/logic/shared/database/DatabaseClient.ts` → `src/modules/shared/infrastructure/DatabaseClient.ts`
- `src/logic/shared/services.ts` → `src/modules/shared/services.ts`

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `DateTimeInterface` (port) | new (copy) | `src/modules/shared/domain/interfaces/DateTimeInterface.ts` | Same contract as legacy `utils/DateTimeInterface.ts`, moved to `domain/interfaces/`. |
| `PasswordHasherInterface` (port) | new (copy) | `src/modules/shared/domain/interfaces/PasswordHasherInterface.ts` | Same contract as legacy; already in `domain/interfaces/`. |
| `DateTimeService` (adapter) | new (copy) | `src/modules/shared/infrastructure/DateTimeService.ts` | Same class/name; imports the new `DateTimeInterface` path. |
| `BcryptPasswordHasher` (adapter) | new (copy) | `src/modules/shared/infrastructure/BcryptPasswordHasher.ts` | Same class/name; flattened out of `security/`; imports the new `PasswordHasherInterface` path. |
| `DatabaseClient` (+ `DatabaseConfig`, `DatabaseConnection` types) | new (copy) | `src/modules/shared/infrastructure/DatabaseClient.ts` | Same class/types/name; flattened out of `database/`. |
| `services.ts` (composition root) | new (copy) | `src/modules/shared/services.ts` | Exports `databaseClient`, `passwordHasher`, `dateTimeService` singletons; imports the new adapter paths and `@src/config`. |
| ESLint boundaries config | existing | `.eslintrc.json` | Add a `shared` element entry for `src/modules/shared` alongside the existing `src/logic/shared` entry. |
| `DateTimeService` unit test | new (copy) | `tests/unit/modules/shared/infrastructure/DateTimeService.test.ts` | Mirror of legacy test, re-pointed to new path. |
| `DatabaseClient` unit test | new (copy) | `tests/unit/modules/shared/infrastructure/DatabaseClient.test.ts` | Mirror of legacy test, re-pointed to new path. |
| `BcryptPasswordHasher` integration test | new (copy) | `tests/integration/modules/shared/infrastructure/BcryptPasswordHasher.test.ts` | Mirror of legacy test, re-pointed to new path. |
| `services.ts` composition test | new | `tests/unit/modules/shared/services.test.ts` | Asserts the entry point exposes the three instances. |

Legacy files under `src/logic/shared/**` and `tests/**/logic/shared/**`, and the
prompt/user/auth contexts, are **not** touched.

## 3. Interfaces & contracts

Public surfaces are preserved verbatim (Decision 1):

- `DateTimeInterface` — `now(): Date` (default export).
- `PasswordHasherInterface` — `hash(password: string): Promise<string>`, `compare(password: string, hash: string): Promise<boolean>` (default export).
- `DateTimeService implements DateTimeInterface` — `now(): Date`.
- `BcryptPasswordHasher implements PasswordHasherInterface` — `hash`, `compare` (10 salt rounds).
- `DatabaseClient<DatabaseSchema>` — `constructor(config: DatabaseConfig, schema: DatabaseSchema)`, `connect(): DatabaseConnection<DatabaseSchema>`, `close(): Promise<void>`; plus exported `DatabaseConfig` and `DatabaseConnection<DatabaseSchema>` types (default export of the class, named exports of the types).
- `services.ts` — named exports `databaseClient`, `passwordHasher`, `dateTimeService`.

Error mapping: none — this work defines no error responses (spec §4).

| E# | Domain error | Response the user sees |
|--|--|--|
| — | none | none |

## 4. Data & persistence

None. No schema, table, column, or migration changes. `DatabaseClient` is relocated
code; the aggregated Drizzle schema in `src/config.ts` is unchanged (it references the
prompt/user context schemas, not the shared context).

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Each capability reachable from the new location with the same public surface | New unit/integration tests (AC1–AC4) exercising the new import paths | — |
| V2 | Contracts kept separate from implementations (ports in `domain/interfaces/`, adapters in `infrastructure/`) | Directory layout of the new files; `eslint-plugin-boundaries` | — |
| V3 | Legacy copy and business areas unchanged | `git diff` shows no change under `src/logic/**` or the legacy tests; existing suite still green | — |
| V4 | Quality gates pass | `npm run lint`, `npm run typecheck`, `npm test` | — |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, silent):
1. The new context is imported via the `@src/modules/shared/...` alias form per CLAUDE.md (no new tsconfig path alias is added) — consequence if wrong: import specifiers would need adjusting, but resolution still works via `@src/*`.
2. Test files mirror the legacy directory shape under `tests/unit/modules/shared/` and `tests/integration/modules/shared/`, keeping the layer-based split from `testing-practices` (adapter integration lives in `integration/`, the trivial clock/DB-client unit tests in `unit/`) — consequence if wrong: only test-file placement differs, no behavior impact.
3. A second `shared` element (pattern `src/modules/shared`) is added to `.eslintrc.json` alongside the existing legacy one; both keep `type: "shared"` so the existing boundary rules apply to the new folder unchanged — consequence if wrong: boundary rules would not cover the new folder, but lint would still pass (unknown elements are allowed).

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Duplicated shared code drifts between the legacy and new copies before business areas migrate | med | low (interim only; deferred cleanup) | Keep the new copy byte-identical; a follow-up spec migrates business areas and deletes the legacy copy. |
| R2 | `services.ts` composition test triggers real config/env loading (it constructs `DatabaseClient` from `@src/config`) | low | low | The client is lazy — no `Pool` is created until `connect()`; asserting `instanceof` opens no connection, mirroring how the legacy `services.ts` is already imported by the running app. |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Reuse connection | `connect()` called twice | A single pool is created and reused | AC2 |
| Reconnect after close | `connect()`, `close()`, `connect()` | A fresh pool is created after close | AC2 |
| Close with no open connection | `close()` before any `connect()` | Safe no-op, resolves undefined, pool never ended | AC2 |
| Non-matching password | `compare('wrong', hash)` | Resolves false | AC3 |
| Hash is not plaintext | `hash('secret')` | Result differs from plaintext and verifies true | AC3 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | §2 all new capability files; §5 V1; §3 preserved surfaces |
| V2 | §2 layer placement (domain/interfaces vs infrastructure); §5 V2; boundaries element |
| V3 | §1 "left unchanged"; §5 V3 (`git diff`) |
| V4 | §5 V4 (lint/typecheck/test) |
| AC1 | `DateTimeService` + `DateTimeInterface` files + unit test |
| AC2 | `DatabaseClient` file + unit test; §8 connection edge cases |
| AC3 | `BcryptPasswordHasher` + `PasswordHasherInterface` files + integration test; §8 password edge cases |
| AC4 | `services.ts` + composition test |
| AC5 | §1 coexistence; §5 V3 |
| AC6 | §5 V4 |