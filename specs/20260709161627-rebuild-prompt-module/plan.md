# Plan: Rebuild the prompt management capability in the current module structure
Spec: specs/20260709161627-rebuild-prompt-module/spec.md

## 1. Approach

Rebuild `src/logic/prompt/` as a new, standalone bounded context at
`src/modules/prompt/`, following the `domain-driven-design` skill's conventions
exactly (entities as `type`, default-exported repository interfaces, `invoke()`
use cases, adapters grouped in a named `infrastructure/` subfolder). The new
context depends on the already-rebuilt `src/modules/shared` (per Decision #2) for
its database connection and current-time port, and gains one new capability that
`src/modules/shared` doesn't have yet: a shared identifier-generation port
(`IdGeneratorInterface` + `UuidGenerator`), matching the skill's own canonical
worked example in interface/class shape, but filed under `infrastructure/utils/`
(alongside the existing sibling adapter `DateTimeService`) rather than the skill's
`infrastructure/identity/` example path. `CreatePromptUseCase` and `UpdatePromptUseCase`
are rebuilt to generate identifiers/timestamps internally instead of receiving
them as input (V5), everything else is a faithful, behavior-preserving port of the
existing implementation at `src/logic/prompt/`.

Nothing under `src/logic/**`, `src/handlers/**`, `src/config.ts`, or any existing
test file is touched — the new context is built, wired to itself via its own
`services.ts`, and verified in full isolation. It is not imported from anywhere
outside itself. Making it live is explicitly deferred (spec §1 "Out of scope").

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `IdGeneratorInterface` | New | `src/modules/shared/domain/interfaces/IdGeneratorInterface.ts` | Default-exported port: `generate(): string`. |
| `UuidGenerator` | New | `src/modules/shared/infrastructure/utils/UuidGenerator.ts` | Implements `IdGeneratorInterface` via `node:crypto`'s `randomUUID()`. Filed under `infrastructure/utils/`, colocated with the existing `DateTimeService` adapter, rather than a dedicated `infrastructure/identity/` subfolder. |
| `DrizzleDatabaseConnection` | Existing | `src/modules/shared/services.ts` | Already implemented (`export type DrizzleDatabaseConnection = ReturnType<typeof databaseClient.connect>;`, verified via `npm run typecheck`/`npm run lint`). Reused as-is — see §7 Assumption 3. |
| Shared wiring | Existing | `src/modules/shared/services.ts` | Add `export const idGenerator = new UuidGenerator();`. |
| `Prompt` entity | New | `src/modules/prompt/domain/Prompt.ts` | `Prompt`, `UpdatePrompt`, `PromptFilter` as `export type` (ported from `src/logic/prompt/domain/Prompt.ts`, `interface` → `type` per Decision #1). |
| `PromptCategory` entity | New | `src/modules/prompt/domain/PromptCategory.ts` | `PromptCategory` as `export type` (ported from `src/logic/prompt/domain/PromptCategory.ts`). |
| `PromptNotFoundError` | New | `src/modules/prompt/domain/errors/PromptNotFoundError.ts` | Ported unchanged from `src/logic/prompt/domain/errors/PromptNotFoundError.ts`. |
| `CategoryNotFoundError` | New | `src/modules/prompt/domain/errors/CategoryNotFoundError.ts` | Ported unchanged from `src/logic/prompt/domain/errors/CategoryNotFoundError.ts`. |
| `PromptRepositoryInterface` | New | `src/modules/prompt/domain/interfaces/PromptRepositoryInterface.ts` | Ported unchanged (default export) from `src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`. |
| `PromptCategoryRepositoryInterface` | New | `src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.ts` | Ported unchanged (default export) from `src/logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.ts`. |
| `ListPromptCategoriesUseCase` | New | `src/modules/prompt/application/ListPromptCategoriesUseCase.ts` | Ported unchanged from `src/logic/prompt/application/ListPromptCategoriesUseCase.ts`. |
| `ListPromptsUseCase` | New | `src/modules/prompt/application/ListPromptsUseCase.ts` | Ported unchanged from `src/logic/prompt/application/ListPromptsUseCase.ts`. |
| `GetPromptUseCase` | New | `src/modules/prompt/application/GetPromptUseCase.ts` | Ported unchanged from `src/logic/prompt/application/GetPromptUseCase.ts`. |
| `DeletePromptUseCase` | New | `src/modules/prompt/application/DeletePromptUseCase.ts` | Ported unchanged from `src/logic/prompt/application/DeletePromptUseCase.ts`. |
| `CreatePromptUseCase` | New | `src/modules/prompt/application/CreatePromptUseCase.ts` | Rebuilt: `CreatePromptQuery` drops `id`/`createdAt`/`updatedAt`; constructor gains `DateTimeInterface`+`IdGeneratorInterface`; `invoke()` calls `dateTime.now()` once (reused for both timestamps) and `idGenerator.generate()`. |
| `UpdatePromptUseCase` | New | `src/modules/prompt/application/UpdatePromptUseCase.ts` | Rebuilt: `UpdatePromptQuery` drops `updatedAt` (keeps `id`); constructor gains `DateTimeInterface`; `invoke()` calls `dateTime.now()` once; response still assembled manually from the pre-fetched existing prompt + new values (Decision #4 — no re-fetch after write). |
| Drizzle schema | New | `src/modules/prompt/infrastructure/persistence/schema.ts` | Ported unchanged (same table/column names/types/constraints) from `src/logic/prompt/infrastructure/database/schema.ts`. |
| `DrizzlePromptCategoryRepository` | New | `src/modules/prompt/infrastructure/persistence/DrizzlePromptCategoryRepository.ts` | Ported from `src/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts`; only its database-connection typing changes — constructor parameter typed `DrizzleDatabaseConnection`, imported from `@src/modules/shared/services.js` (§7 Assumption 3). |
| `DrizzlePromptRepository` | New | `src/modules/prompt/infrastructure/persistence/DrizzlePromptRepository.ts` | Ported from `src/logic/prompt/infrastructure/database/DrizzlePromptRepository.ts`, preserving the `sql\`${col}::text\`` non-UUID-tolerance casts verbatim (spec §3/§6 Decision 4 of `002-list-prompts`); only its database-connection typing changes — same `DrizzleDatabaseConnection` as above (§7 Assumption 3). |
| Prompt module wiring | New | `src/modules/prompt/services.ts` | Composition root: one shared `db` const (fixing the legacy file's double `connect()` call), both repositories, all 6 use cases, `Create`/`UpdatePromptUseCase` additionally wired with `dateTimeService`/`idGenerator` from `@src/modules/shared/services.js`. |
| Boundary enforcement | Existing | `.eslintrc.json` | Extend the `domain`/`application`/`infrastructure` `boundaries/elements` `pattern` values from a single string to an array also matching `src/modules/*/{domain,application,infrastructure}`, so the new context's layers are enforced (today only `src/logic/*/...` is matched; `src/modules/shared` currently only works via its own coarse `"shared"` folder-mode entry). |

## 3. Interfaces & contracts

```typescript
// src/modules/shared/domain/interfaces/IdGeneratorInterface.ts
export default interface IdGeneratorInterface {
    generate(): string;
}

// src/modules/prompt/application/CreatePromptUseCase.ts
export type CreatePromptQuery = {
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
};
class CreatePromptUseCase {
    constructor(
        promptRepository: PromptRepositoryInterface,
        categoryRepository: PromptCategoryRepositoryInterface,
        dateTime: DateTimeInterface,
        idGenerator: IdGeneratorInterface,
    );
    invoke(query: CreatePromptQuery): Promise<Prompt>;
}

// src/modules/prompt/application/UpdatePromptUseCase.ts
export type UpdatePromptQuery = {
    id: string;
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
};
class UpdatePromptUseCase {
    constructor(
        promptRepository: PromptRepositoryInterface,
        categoryRepository: PromptCategoryRepositoryInterface,
        dateTime: DateTimeInterface,
    );
    invoke(query: UpdatePromptQuery): Promise<Prompt>;
}
```

`GetPromptQuery`/`DeletePromptQuery` (`{ id: string }`), `ListPromptsQuery`
(`{ categoryId?: string }`)/`ListPromptsResponse`, and `PromptCategoryResponse` are
unchanged from `src/logic/prompt/application/*.ts` (only `interface` → `type`).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `CategoryNotFoundError` (thrown by `CreatePromptUseCase`/`UpdatePromptUseCase`) | Not yet mapped to a response — this context isn't wired to any handler in this spec; the error class/message alone is what's verified (identical to `src/logic/prompt`'s). |
| E2 | `PromptNotFoundError` (thrown by `GetPromptUseCase`/`UpdatePromptUseCase`/`DeletePromptUseCase`) | Same as above. |

## 4. Data & persistence

None — the new `infrastructure/persistence/schema.ts` re-declares the exact same
`prompts`/`prompt_categories` tables (same names, columns, types, nullability, and
foreign key) that `src/logic/prompt/infrastructure/database/schema.ts` already
defines, at a new file path only. No migration is generated or required (verified
in T18 by running `npx drizzle-kit generate` and confirming it produces no new
file).

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Read operations return identical results to the existing implementation | `ListPromptCategoriesUseCase`, `ListPromptsUseCase`, `GetPromptUseCase` + their repositories, ported logic | → E2 for `GetPromptUseCase` when not found; — otherwise |
| V2 | Write operations behave identically to the existing implementation | `CreatePromptUseCase`, `UpdatePromptUseCase`, `DeletePromptUseCase` + repositories | → E1/E2 per operation; — otherwise |
| V3 | Invalid category reference rejected on create/update | `CreatePromptUseCase.invoke()` / `UpdatePromptUseCase.invoke()`, `categoryRepository.findById()` check | → E1 |
| V4 | Unknown prompt id rejected on get/update/delete | `GetPromptUseCase.invoke()` / `UpdatePromptUseCase.invoke()` / `DeletePromptUseCase.invoke()`, `promptRepository.findById()` check | → E2 |
| V5 | Id/timestamps generated internally, not supplied | `CreatePromptUseCase.invoke()` (`idGenerator.generate()`, `dateTime.now()`), `UpdatePromptUseCase.invoke()` (`dateTime.now()`) | — |
| V6 | Contracts separate from implementations | `domain/interfaces/*.ts` vs `infrastructure/**/*.ts`, enforced by `.eslintrc.json` boundary rules | — |
| V7 | Existing implementation and consumers unchanged | Process constraint: no edits to `src/logic/prompt/**`, `src/handlers/**`, `src/config.ts`, or any pre-existing test file | — |
| V8 | No storage change | `infrastructure/persistence/schema.ts` byte-for-byte-equivalent table defs; verified via `drizzle-kit generate` | — |

## 6. Dependency changes

None. `node:crypto`'s `randomUUID()` is a Node builtin; every other new file
depends only on already-installed packages (`drizzle-orm`, `vitest`,
`vitest-mock-extended`, `@faker-js/faker`) and the already-existing
`src/modules/shared` composition root.

## 7. Assumptions & risks

Assumptions:
1. Subfolder name `infrastructure/persistence/` (schema + Drizzle repos) matches the
   `domain-driven-design` skill's own canonical worked example. The id-generator
   adapter deliberately deviates from the skill's `infrastructure/identity/` example
   path: it's filed under `infrastructure/utils/` instead, colocated with the
   existing sibling adapter `DateTimeService` (already at
   `src/modules/shared/infrastructure/utils/DateTimeService.ts`) — both are small,
   stateless technical adapters with no domain vocabulary of their own, so grouping
   them together reads more consistently than splitting them across two
   single-adapter subfolders. Consequence if wrong: a cosmetic rename, no behavior
   change.
2. The id-generator adapter's class name is `UuidGenerator` (matching the skill's
   canonical example verbatim, rather than inventing a different name for the same
   `node:crypto` technology) — consequence if wrong: cosmetic rename.
3. `src/modules/shared/services.ts` already exports
   `DrizzleDatabaseConnection = ReturnType<typeof databaseClient.connect>` — a
   non-generic, fully schema-typed alias (`NodePgDatabase<typeof
   config.database.schema>`, not `unknown` and not a generic `Record<string,
   unknown>` fallback) derived directly off the existing `databaseClient` singleton.
   This was added ahead of this spec and already verified with `npm run typecheck`/
   `npm run lint`. The new prompt repositories' `db` constructor parameter is typed
   `DrizzleDatabaseConnection`, imported from `@src/modules/shared/services.js`,
   instead of hand-parametrizing the domain-level `DatabaseConnection<T>` generic
   (which stays untouched, and stays free of Drizzle types, since it's the domain
   layer's opaque passthrough — `DrizzleDatabaseConnection` lives in `services.ts`,
   not in `domain/`). Consequence if wrong: a compile error surfaces immediately in
   T14/T15's Green step, which per the SDD "implementation reveals a gap" rule sends
   this back to PLANNING rather than being silently patched.
4. `tests/lib/config.ts`'s existing `TestDatabaseConnection = ReturnType<typeof
   databaseClient.connect>` (built on the legacy `@logic/shared/database/DatabaseClient.js`,
   whose `connect()` returns `NodePgDatabase<DatabaseSchema>` directly, parametrized
   with the same `typeof config.database.schema` from the same `src/config.ts`) is
   structurally identical to `DrizzleDatabaseConnection` and needs no change — a
   `TestDatabaseConnection` value is assignable wherever the new repositories expect
   `DrizzleDatabaseConnection`. Consequence if wrong: T14/T15's integration test
   tasks fail to compile, surfaced immediately.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Extending `.eslintrc.json`'s element patterns to arrays has an unintended interaction with the existing `src/logic/*` boundary rules | Low | Medium — could silently stop enforcing legacy boundaries | Change is additive (array includes the existing string pattern unchanged); verify with a deliberate illegal-import sanity check in both `src/logic/prompt` and `src/modules/prompt` before/after |
| R2 | A later spec introduces the identifier-generation port with a different name/shape, causing rework | Low | Low | Name/shape matches the DDD skill's own canonical example exactly, minimizing the chance a future spec diverges |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Category filter not UUID-shaped | `ListPromptsUseCase.invoke({ categoryId: 'not-a-uuid' })` | Repository's `::text` cast means it matches nothing; empty array, no error | AC2 |
| Prompt id not UUID-shaped | `GetPromptUseCase.invoke({ id: 'not-a-uuid' })` | Repository's `::text` cast means it matches nothing; `PromptNotFoundError` (E2) | AC3 |
| Prompt created with no description | `CreatePromptUseCase.invoke({ ...,  description: undefined })` | Created and returned with `description: undefined`, not an error | AC4 |
| Prompt updated to empty-string description | `UpdatePromptUseCase.invoke({ ..., description: '' })` | Persisted as `''`, distinct from "no description" (`null`) | AC6 |
| Create: two timestamp fields, one clock read | `CreatePromptUseCase.invoke(query)` | `dateTime.now()` called exactly once; `createdAt === updatedAt` on the returned prompt | AC4 |
| Update: prompt missing | `UpdatePromptUseCase.invoke({ id: unknownId, ... })` | `PromptNotFoundError` (E2); category is never looked up; `dateTime.now()` never called | AC7 |
| Update: category missing | `UpdatePromptUseCase.invoke({ ..., categoryId: unknownId })` | `CategoryNotFoundError` (E1); nothing persisted | AC7 |
| Legacy untouched | After all tasks | `git diff`/`git status` shows zero changes under `src/logic/**`, `src/handlers/**`, `src/config.ts`, and every pre-existing test file | AC9 |
| No new migration | After T13 | `npx drizzle-kit generate` produces no new SQL file | AC9 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | `ListPromptCategoriesUseCase`, `ListPromptsUseCase`, `GetPromptUseCase` + repositories (§2) |
| V2 | `CreatePromptUseCase`, `UpdatePromptUseCase`, `DeletePromptUseCase` + repositories (§2) |
| V3 | `CreatePromptUseCase.invoke()`, `UpdatePromptUseCase.invoke()` category check (§5) |
| V4 | `GetPromptUseCase.invoke()`, `UpdatePromptUseCase.invoke()`, `DeletePromptUseCase.invoke()` prompt check (§5) |
| V5 | `IdGeneratorInterface`/`UuidGenerator`, `DateTimeInterface` usage in `Create`/`UpdatePromptUseCase` (§2, §3) |
| V6 | `domain/interfaces/*` vs `infrastructure/**`, `.eslintrc.json` boundary patterns (§2) |
| V7 | Process constraint — no file under `src/logic/**`/`src/handlers/**`/`src/config.ts`/existing tests is touched (§1) |
| V8 | `infrastructure/persistence/schema.ts` (§2, §4) |
| E1 | `CategoryNotFoundError` (§2, §3) |
| E2 | `PromptNotFoundError` (§2, §3) |
| AC1 | `ListPromptCategoriesUseCase`, `DrizzlePromptCategoryRepository`, `services.ts` |
| AC2 | `ListPromptsUseCase`, `DrizzlePromptRepository`, `services.ts` |
| AC3 | `GetPromptUseCase`, `DrizzlePromptRepository`, `services.ts` |
| AC4 | `CreatePromptUseCase`, `DrizzlePromptRepository`, `services.ts` |
| AC5 | `CreatePromptUseCase` |
| AC6 | `UpdatePromptUseCase`, `DrizzlePromptRepository`, `services.ts` |
| AC7 | `UpdatePromptUseCase` |
| AC8 | `DeletePromptUseCase`, `DrizzlePromptRepository`, `services.ts` |
| AC9 | Process constraint (§1) + `.eslintrc.json` + full-suite verification task |
