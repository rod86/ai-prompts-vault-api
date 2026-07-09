# Plan: Harden the prompt module's create and update operations
Spec: specs/20260709185305-prompt-create-update-hardening/spec.md

## 1. Approach
Four small, additive changes inside `src/modules/prompt`, all touching existing files
rather than adding new bounded-context structure:

1. `UpdatePromptUseCase` skips `categoryRepository.findById` when the requested
   `categoryId` already equals `existingPrompt.category.id`, reusing the existing
   category instead.
2. `CreatePromptUseCase` and `UpdatePromptUseCase` each wrap their single
   `promptRepository.create`/`.update` call in a `try/catch`, rethrowing a new,
   operation-specific domain error that carries the original error as `cause`.
3. `Prompt.ts` gains a `CreatePrompt` type (mirroring the existing `UpdatePrompt`
   pattern, but with all fields required except `description`), and
   `PromptRepositoryInterface.create` / `DrizzlePromptRepository.create` are retyped
   to take it instead of the full `Prompt`, so the save step only ever sees a category
   id, never the category's name.
4. `src/modules/prompt/infrastructure/persistence/` is renamed to
   `src/modules/prompt/infrastructure/database/`, matching
   `src/modules/shared/infrastructure/database/` — pure relocation, no behavior change.

Reused patterns: the existing `CategoryNotFoundError`/`PromptNotFoundError` pair (same
`domain/errors/*.ts` shape: `extends Error`, sets `this.name`) is the template for the
two new error classes; the existing `UpdatePrompt` type is the template for the new
`CreatePrompt` type.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `UpdatePromptUseCase` | existing | `src/modules/prompt/application/UpdatePromptUseCase.ts` | Skip category lookup when `categoryId` unchanged; wrap `repository.update` in try/catch → `PromptUpdateError`. |
| `CreatePromptUseCase` | existing | `src/modules/prompt/application/CreatePromptUseCase.ts` | Build a `CreatePrompt` for persistence, separate from the returned `Prompt`; wrap `repository.create` in try/catch → `PromptCreationError`. |
| `Prompt` domain types | existing | `src/modules/prompt/domain/Prompt.ts` | Add `CreatePrompt` type. |
| `PromptRepositoryInterface` | existing | `src/modules/prompt/domain/interfaces/PromptRepositoryInterface.ts` | `create(prompt: Prompt)` → `create(prompt: CreatePrompt)`. |
| `PromptCreationError` | new | `src/modules/prompt/domain/errors/PromptCreationError.ts` | New error class: `constructor(id: string, cause: unknown)`. |
| `PromptUpdateError` | new | `src/modules/prompt/domain/errors/PromptUpdateError.ts` | New error class: `constructor(id: string, cause: unknown)`. |
| `DrizzlePromptRepository` | existing (relocated) | `src/modules/prompt/infrastructure/database/DrizzlePromptRepository.ts` (was `infrastructure/persistence/...`) | Moved; `create()` body reads `prompt.categoryId` instead of `prompt.category.id`. |
| `DrizzlePromptCategoryRepository` | existing (relocated) | `src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts` (was `infrastructure/persistence/...`) | Moved only, no logic change. |
| Prompt schema | existing (relocated) | `src/modules/prompt/infrastructure/database/schema.ts` (was `infrastructure/persistence/...`) | Moved only, no logic change. |
| Composition root | existing | `src/modules/prompt/services.ts` | Update the two import paths from `infrastructure/persistence/...` to `infrastructure/database/...`. |
| Repository integration test | existing (relocated) | `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts` (was `.../persistence/...`) | Moved; `create` describe block's fixtures updated to `categoryId` instead of nested `category`. |
| Category repository integration test | existing (relocated) | `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.test.ts` (was `.../persistence/...`) | Moved only, import path updated. |
| `CreatePromptUseCase` unit test | existing | `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts` | Update the `repository.create` call-args assertion to the `CreatePrompt` shape; add a persistence-failure case. |
| `UpdatePromptUseCase` unit test | existing | `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` | Add unchanged-category (no-lookup) case and a persistence-failure case. |

## 3. Interfaces & contracts

```ts
// src/modules/prompt/domain/Prompt.ts
export type CreatePrompt = {
    id: string;
    categoryId: string;
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
};
```

```ts
// src/modules/prompt/domain/interfaces/PromptRepositoryInterface.ts
create(prompt: CreatePrompt): Promise<void>;
```

```ts
// src/modules/prompt/domain/errors/PromptCreationError.ts
export class PromptCreationError extends Error {
    constructor(id: string, cause: unknown) {
        super(`Failed to create prompt: ${id}`, { cause });
        this.name = 'PromptCreationError';
    }
}

// src/modules/prompt/domain/errors/PromptUpdateError.ts
export class PromptUpdateError extends Error {
    constructor(id: string, cause: unknown) {
        super(`Failed to update prompt: ${id}`, { cause });
        this.name = 'PromptUpdateError';
    }
}
```

`UpdatePromptUseCase.invoke` category-lookup branch:
```ts
const category =
    query.categoryId === existingPrompt.category.id
        ? existingPrompt.category
        : await this.categoryRepository.findById(query.categoryId);

if (!category) {
    throw new CategoryNotFoundError(query.categoryId);
}
```

E# → concrete error mapping:

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `CategoryNotFoundError` (unchanged) | Thrown from the use case; no route wires this module yet, so no HTTP shape changes. |
| E2 | `PromptNotFoundError` (unchanged) | Thrown from the use case; no route wires this module yet. |
| E3 | `PromptCreationError` (new) | Thrown from `CreatePromptUseCase.invoke`, wrapping the repository's original error as `cause`. |
| E4 | `PromptUpdateError` (new) | Thrown from `UpdatePromptUseCase.invoke`, wrapping the repository's original error as `cause`. |

## 4. Data & persistence
None. No schema or migration changes — `CreatePrompt` reshapes an in-memory parameter,
it does not change any column, table, or stored value.

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Unchanged category id skips the lookup, using the existing category, even if that category no longer exists | `UpdatePromptUseCase.invoke` | — |
| V2 | Changed category id still looked up and validated | `UpdatePromptUseCase.invoke` | → E1 |
| V3 | Create-save failure wrapped in its own error | `CreatePromptUseCase.invoke` (try/catch around `promptRepository.create`) | → E3 |
| V4 | Update-save failure wrapped in its own error | `UpdatePromptUseCase.invoke` (try/catch around `promptRepository.update`) | → E4 |
| V5 | Storage-adapter folder named like the shared module's | `src/modules/prompt/infrastructure/database/` (relocated) | — |
| V6 | Create's save step receives only the category id | `CreatePromptUseCase.invoke` (builds `CreatePrompt` separately from the returned `Prompt`); `PromptRepositoryInterface.create` / `DrizzlePromptRepository.create` signature | — |
| V7 | Quality gates pass | `npm run lint`, `npm run typecheck`, `npm test` | — |

## 6. Dependency changes
None.

## 7. Assumptions & risks
Assumptions:
1. `CreatePrompt.description` is optional and non-nullable (`description?: string`),
   mirroring `Prompt.description` rather than `UpdatePrompt.description`'s
   `string | null` — a brand-new prompt has no prior value to explicitly clear, it
   simply may or may not have one. Consequence if wrong: a caller that intentionally
   passes `null` would need a type change later.
2. `CreatePrompt` includes `id` (the use case still self-assigns it via
   `idGenerator.generate()` before building the object) — consistent with the
   project's "id is app-provided on insert" persistence convention. Consequence if
   wrong: `DrizzlePromptRepository.create` would need a separate id parameter.
3. The two new error classes are named `PromptCreationError` and `PromptUpdateError`,
   following the existing `<Subject><Reason>Error` naming used by
   `CategoryNotFoundError`/`PromptNotFoundError`. Consequence if wrong: purely
   cosmetic, easy rename.
4. The relocated test folder mirrors the source rename exactly
   (`tests/integration/modules/prompt/infrastructure/persistence/` →
   `.../infrastructure/database/`), matching the legacy module's existing
   `tests/integration/logic/prompt/infrastructure/database/` naming. Consequence if
   wrong: an inconsistent test-tree naming versus the legacy precedent.
5. Neither `src/modules/prompt` nor its tests are currently wired into `app.ts` /
   `src/config.ts` (routes still use `@logic/prompt`), so none of these changes touch
   any HTTP-visible behavior, `config.ts`'s schema aggregation, or the legacy
   `src/logic/prompt/**` tree. Consequence if wrong: would need to also update
   `app.ts`/`config.ts` wiring and legacy-tree regression tests.
6. The existing `prompts.prompt_category_id` foreign key (`schema.ts`, already in
   place — not introduced by this spec) declares no `onDelete` cascade, so Postgres's
   default `NO ACTION` behavior rejects deleting a category still referenced by any
   prompt. This is what makes skipping the re-validation in V1 safe: a prompt's
   current category can never have been deleted out from under it. Consequence if
   wrong: skipping the lookup could return a prompt with a silently missing category.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Renaming the `persistence` folder mid-flight breaks an import missed by the search | low | medium (build/test failure, caught immediately by `npm run typecheck`/`npm test`) | T1 greps for every `infrastructure/persistence` reference before and after the move. |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Unchanged category, still exists | `query.categoryId === existingPrompt.category.id` | No `categoryRepository.findById` call; update proceeds with the existing category | AC1 |
| Changed category, exists | `query.categoryId !== existingPrompt.category.id`, category found | Category looked up and used | AC2 |
| Changed category, missing | `query.categoryId !== existingPrompt.category.id`, category not found | `CategoryNotFoundError`, nothing persisted | AC3 |
| Create, repository rejects | `promptRepository.create` throws | `PromptCreationError` raised, `.cause` is the original error | AC4 |
| Update, repository rejects | `promptRepository.update` throws | `PromptUpdateError` raised, `.cause` is the original error | AC5 |
| Folder rename | `infrastructure/persistence/*` files | Same files under `infrastructure/database/*`, all imports updated, tests unchanged in behavior | AC6 |
| Create payload shape | A new prompt with an existing category | `promptRepository.create` called with `{ id, categoryId, title, prompt, description, createdAt, updatedAt }` — no nested `category` object | AC7 |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 / AC1 | `UpdatePromptUseCase.invoke` category-lookup branch |
| V2 / AC2 / AC3 / E1 | `UpdatePromptUseCase.invoke` category-lookup branch (else path, unchanged) |
| V3 / AC4 / E3 | `CreatePromptUseCase.invoke` try/catch, `PromptCreationError` |
| V4 / AC5 / E4 | `UpdatePromptUseCase.invoke` try/catch, `PromptUpdateError` |
| V5 / AC6 | `infrastructure/persistence/` → `infrastructure/database/` rename (src + tests + `services.ts` imports) |
| V6 / AC7 | `CreatePrompt` type, `PromptRepositoryInterface.create`, `DrizzlePromptRepository.create` |
| V7 / AC8 | Full-suite verification task |
