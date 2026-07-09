# Tasks: Harden the prompt module's create and update operations
Plan: specs/20260709185305-prompt-create-update-hardening/plan.md

- [x] T1. Rename `infrastructure/persistence/` to `infrastructure/database/`
  - Type: infrastructure
  - Depends on: none
  - Red: none — pure file relocation, no behavior change. Proven by the existing
    `DrizzlePromptRepository.test.ts` / `DrizzlePromptCategoryRepository.test.ts`
    (moved alongside, import paths updated) staying green.
  - Green: move `DrizzlePromptRepository.ts`, `DrizzlePromptCategoryRepository.ts`,
    `schema.ts` from `src/modules/prompt/infrastructure/persistence/` to
    `src/modules/prompt/infrastructure/database/`; update the two import paths in
    `src/modules/prompt/services.ts`; move
    `tests/integration/modules/prompt/infrastructure/persistence/` to
    `tests/integration/modules/prompt/infrastructure/database/`, updating each
    moved test's import path for the class under test. Grep the repo for any
    remaining `infrastructure/persistence` reference before/after to confirm none
    is left.
  - Covers: V5 "AC6"

- [x] T2. `CreatePrompt` domain type and repository contract
  - Type: domain
  - Depends on: T1
  - Red: update `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`'s
    `create` describe block — both cases — to call
    `repository.create({ id, categoryId, title, prompt, description, createdAt,
    updatedAt })` (no nested `category` object). Fails: `create` still expects a
    full `Prompt` with `category`, and `DrizzlePromptRepository.create` still reads
    `prompt.category.id`.
  - Green: add `CreatePrompt` type to `src/modules/prompt/domain/Prompt.ts`; change
    `PromptRepositoryInterface.create`'s parameter type from `Prompt` to
    `CreatePrompt`; update `DrizzlePromptRepository.create` to read
    `prompt.categoryId` instead of `prompt.category.id`.
  - Covers: V6 "AC7"

- [ ] T3. `CreatePromptUseCase` builds a `CreatePrompt` for persistence
  - Type: application
  - Depends on: T2
  - Red: update `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts`'s
    `expect(promptRepository.create).toHaveBeenCalledWith(expected)` assertion to
    expect the `CreatePrompt` shape (`categoryId`, no nested `category`), while the
    use case's own return value keeps asserting the full assembled `Prompt` (with
    `category`). Fails: the use case still passes the full `Prompt` to `create`.
  - Green: rewrite `CreatePromptUseCase.invoke` to build the common fields once,
    pass `{ ...common, categoryId: category.id }` to `promptRepository.create`, and
    return `{ ...common, category }` to the caller.
  - Covers: V6 "AC7"

- [ ] T4. `CreatePromptUseCase` wraps save failures in `PromptCreationError`
  - Type: application
  - Depends on: T3
  - Red: add a test to `CreatePromptUseCase.test.ts` — "throws PromptCreationError
    wrapping the original error when the repository rejects while creating" —
    mocks `promptRepository.create` to reject with a fixture `Error`, asserts the
    use case rejects with `PromptCreationError` whose `.cause` is that fixture
    error. Fails: `PromptCreationError` doesn't exist yet and the rejection
    propagates unwrapped.
  - Green: add `src/modules/prompt/domain/errors/PromptCreationError.ts`
    (`constructor(id: string, cause: unknown)`, message
    `` `Failed to create prompt: ${id}` ``, `super(message, { cause })`); wrap the
    `await this.promptRepository.create(...)` call in `CreatePromptUseCase.invoke`
    in a try/catch that rethrows `new PromptCreationError(createPrompt.id, error)`.
  - Covers: V3, E3 "AC4"

- [ ] T5. `UpdatePromptUseCase` skips the category lookup when unchanged
  - Type: application
  - Depends on: T1
  - Red: add a test to
    `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` — "does not
    look up the category and reuses the existing one when the requested category id
    is unchanged" — builds an existing prompt, calls `invoke` with
    `query.categoryId` equal to `existingPrompt.category.id`, asserts
    `categoryRepository.findById` was never called and the returned `category`
    equals `existingPrompt.category`. Fails: the current implementation always
    calls `categoryRepository.findById`.
  - Green: in `UpdatePromptUseCase.invoke`, replace the unconditional
    `categoryRepository.findById` call with the conditional from plan.md §3 (reuse
    `existingPrompt.category` when `query.categoryId === existingPrompt.category.id`,
    otherwise look it up); keep the existing `CategoryNotFoundError` check
    afterwards. The pre-existing "throws CategoryNotFoundError ... when the category
    does not exist" test (differing category id) continues to prove the
    still-validated, changed-category path with no changes needed.
  - Covers: V1 "AC1"; V2, E1 "AC2, AC3" (regression, pre-existing test)

- [ ] T6. `UpdatePromptUseCase` wraps save failures in `PromptUpdateError`
  - Type: application
  - Depends on: T5
  - Red: add a test to `UpdatePromptUseCase.test.ts` — "throws PromptUpdateError
    wrapping the original error when the repository rejects while updating" — mocks
    `promptRepository.update` to reject with a fixture `Error`, asserts the use
    case rejects with `PromptUpdateError` whose `.cause` is that fixture error.
    Fails: `PromptUpdateError` doesn't exist yet and the rejection propagates
    unwrapped.
  - Green: add `src/modules/prompt/domain/errors/PromptUpdateError.ts`
    (`constructor(id: string, cause: unknown)`, message
    `` `Failed to update prompt: ${id}` ``, `super(message, { cause })`); wrap the
    `await this.promptRepository.update(...)` call in `UpdatePromptUseCase.invoke`
    in a try/catch that rethrows `new PromptUpdateError(query.id, error)`.
  - Covers: V4, E4 "AC5"

- [ ] T7. Full-suite verification
  - Type: infrastructure
  - Depends on: T1, T2, T3, T4, T5, T6
  - Red: none — verification step, no new behavior.
  - Green: run `npm run lint`, `npm run typecheck`, `npm test` (all green); confirm
    no leftover `infrastructure/persistence` reference remains anywhere in `src` or
    `tests`; confirm `src/logic/prompt/**`, `src/handlers/**`, `src/config.ts`, and
    `app.ts` are unchanged.
  - Covers: V7 "AC8"

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given an existing prompt, When it is updated with the same category id it already has, Then the category's existence is not checked and the update proceeds using the category the prompt already carries. | T5 |
| AC2 | Given an existing prompt, When it is updated with a different category id that exists, Then that category is looked up and used. | T5 (pre-existing coverage, unchanged) |
| AC3 | Given an existing prompt, When it is updated with a different category id that does not exist, Then the category-invalid error (E1) is raised and nothing is changed. | T5 (pre-existing coverage, unchanged) |
| AC4 | Given a valid new prompt, When the underlying store fails while saving it, Then the create-save-failed error (E3) is raised, distinct from the category-invalid error. | T4 |
| AC5 | Given a valid update to an existing prompt, When the underlying store fails while saving it, Then the update-save-failed error (E4) is raised, distinct from the category-invalid and prompt-not-found errors. | T6 |
| AC6 | Given the module's storage-adapter folder, When it is inspected, Then it is named the same way as the shared module's equivalent folder, and its behavior is unchanged. | T1 |
| AC7 | Given a new prompt being created, When it is handed to the save step, Then that step receives only the category's identifier, not its full details, while the value handed back to the caller still carries the full category. | T2, T3 |
| AC8 | Given the change is complete, When the project's lint, type-check, and full test suite are run, Then all pass. | T7 |
