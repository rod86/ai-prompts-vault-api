# Tasks: Rebuild the prompt management capability in the current module structure
Plan: specs/20260709161627-rebuild-prompt-module/plan.md

- [x] T1. Add the `IdGeneratorInterface` port
  - Type: domain
  - Depends on: none
  - Red: none — pure interface declaration, no logic; see `testing-practices` "no logic, no test" rule.
  - Green: create `src/modules/shared/domain/interfaces/IdGeneratorInterface.ts` — default-exported `interface IdGeneratorInterface { generate(): string; }`.
  - Covers: V5, V6

- [x] T2. Add the `UuidGenerator` adapter
  - Type: infrastructure
  - Depends on: T1
  - Red: `tests/unit/modules/shared/infrastructure/utils/UuidGenerator.test.ts` — asserts `generate()` returns a UUID-shaped string and that two consecutive calls return different values (mirrors `tests/unit/modules/shared/infrastructure/utils/DateTimeService.test.ts`'s pattern). Fails: `UuidGenerator` doesn't exist yet.
  - Green: create `src/modules/shared/infrastructure/utils/UuidGenerator.ts` implementing `IdGeneratorInterface` via `node:crypto`'s `randomUUID()`.
  - Covers: V5, V6

- [x] T3. Wire `idGenerator` into shared services
  - Type: infrastructure
  - Depends on: T2
  - Red: none — `services.ts` is pure composition; see `testing-practices`.
  - Green: edit `src/modules/shared/services.ts`, add `export const idGenerator = new UuidGenerator();`.
  - Covers: V5

- [x] T4. Add the `Prompt`/`PromptCategory` entities
  - Type: domain
  - Depends on: none
  - Red: none — pure type declarations.
  - Green: create `src/modules/prompt/domain/Prompt.ts` (`Prompt`, `UpdatePrompt`, `PromptFilter` as `export type`, ported from `src/logic/prompt/domain/Prompt.ts`) and `src/modules/prompt/domain/PromptCategory.ts` (`PromptCategory` as `export type`).
  - Covers: V6 (entity shape underlies every AC)

- [x] T5. Add the domain errors
  - Type: domain
  - Depends on: none
  - Red: none — no dedicated test; covered indirectly by the use-case error-branch tests in T9/T10/T11/T12.
  - Green: create `src/modules/prompt/domain/errors/PromptNotFoundError.ts` and `CategoryNotFoundError.ts`, ported unchanged from `src/logic/prompt/domain/errors/*.ts`.
  - Covers: E1, E2

- [x] T6. Add the repository interfaces
  - Type: domain
  - Depends on: T4
  - Red: none — contracts, no dedicated test.
  - Green: create `src/modules/prompt/domain/interfaces/PromptRepositoryInterface.ts` and `PromptCategoryRepositoryInterface.ts`, default-exported, ported unchanged from `src/logic/prompt/domain/interfaces/*.ts`.
  - Covers: V6

- [x] T7. `ListPromptCategoriesUseCase`
  - Type: application
  - Depends on: T6
  - Red: `tests/unit/modules/prompt/application/ListPromptCategoriesUseCase.test.ts` (ported from `tests/unit/logic/prompt/application/ListPromptCategoriesUseCase.test.ts`, import paths updated) — returns all categories from the repository; returns an empty array when there are none. Fails: class doesn't exist.
  - Green: create `src/modules/prompt/application/ListPromptCategoriesUseCase.ts`, ported unchanged.
  - Covers: V1 (AC1)

- [x] T8. `ListPromptsUseCase`
  - Type: application
  - Depends on: T6
  - Red: `tests/unit/modules/prompt/application/ListPromptsUseCase.test.ts` (ported) — returns all prompts; returns an empty array when there are none; forwards the category filter to the repository unchanged. Fails: class doesn't exist.
  - Green: create `src/modules/prompt/application/ListPromptsUseCase.ts`, ported unchanged.
  - Covers: V1 (AC2)

- [x] T9. `GetPromptUseCase`
  - Type: application
  - Depends on: T5, T6
  - Red: `tests/unit/modules/prompt/application/GetPromptUseCase.test.ts` (ported) — returns the prompt from the repository; throws `PromptNotFoundError` (type and message) when the repository returns nothing. Fails: class doesn't exist.
  - Green: create `src/modules/prompt/application/GetPromptUseCase.ts`, ported unchanged.
  - Covers: V1, V4, E2 (AC3)

- [x] T10. `DeletePromptUseCase`
  - Type: application
  - Depends on: T5, T6
  - Red: `tests/unit/modules/prompt/application/DeletePromptUseCase.test.ts` (ported) — deletes an existing prompt; throws `PromptNotFoundError` and does not call delete when the prompt doesn't exist. Fails: class doesn't exist.
  - Green: create `src/modules/prompt/application/DeletePromptUseCase.ts`, ported unchanged.
  - Covers: V2, V4, E2 (AC8)

- [x] T11. `CreatePromptUseCase` with internal id/timestamp generation
  - Type: application
  - Depends on: T1, T4, T5, T6
  - Red: `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts` (ported, substantively rewritten per `plan.md` §2) — mocks `PromptRepositoryInterface`, `PromptCategoryRepositoryInterface`, `DateTimeInterface`, `IdGeneratorInterface`; `buildQuery()` no longer includes `id`/`createdAt`/`updatedAt`; asserts the returned prompt and the `promptRepository.create` call use the mocked generator's id and the mocked clock's time for both `createdAt` and `updatedAt`, and that `dateTime.now()` is called exactly once; keeps the existing "no description" and "`CategoryNotFoundError`, does not persist" cases. Fails: class/constructor shape doesn't exist yet.
  - Green: create `src/modules/prompt/application/CreatePromptUseCase.ts` per `plan.md` §3.
  - Covers: V2, V3, V5, E1 (AC4, AC5)

- [x] T12. `UpdatePromptUseCase` with internal timestamp generation
  - Type: application
  - Depends on: T4, T5, T6
  - Red: `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` (ported, substantively rewritten per `plan.md` §2) — mocks `PromptRepositoryInterface`, `PromptCategoryRepositoryInterface`, `DateTimeInterface`; `buildQuery()` no longer includes `updatedAt` (keeps `id`); asserts `result.updatedAt` and the `promptRepository.update` call's `updatedAt` equal the mocked clock's time, `result.createdAt` still equals the pre-fetched existing prompt's `createdAt` (proves manual reconstruction, not a re-fetch, per Decision #4); the not-found/category-invalid tests additionally assert `dateTime.now()` was never called; keeps the existing "no description"/"empty description" cases. Fails: class/constructor shape doesn't exist yet.
  - Green: create `src/modules/prompt/application/UpdatePromptUseCase.ts` per `plan.md` §3.
  - Covers: V2, V3, V4, V5, E1, E2 (AC6, AC7)

- [ ] T13. Drizzle schema
  - Type: infrastructure
  - Depends on: none
  - Red: none — pure table declarations, no logic.
  - Green: create `src/modules/prompt/infrastructure/persistence/schema.ts`, ported unchanged (same table/column names, types, constraints) from `src/logic/prompt/infrastructure/database/schema.ts`.
  - Covers: V8

- [ ] T14. `DrizzlePromptCategoryRepository`
  - Type: infrastructure
  - Depends on: T6, T13
  - Red: `tests/integration/modules/prompt/infrastructure/persistence/DrizzlePromptCategoryRepository.test.ts` (ported from `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.test.ts`, import paths updated, real DB via `tests/lib/config.ts`) — `findAll` returns categories alphabetically; `findById` returns a match / `undefined` when missing / `undefined` when not UUID-shaped. Fails: class doesn't exist.
  - Green: create `src/modules/prompt/infrastructure/persistence/DrizzlePromptCategoryRepository.ts`, preserving the `sql\`${col}::text\`` cast verbatim; `db` typed `DrizzleDatabaseConnection` (imported from `@src/modules/shared/services.js`) per `plan.md` §7 Assumption 3.
  - Covers: V1, V4 (AC1)

- [ ] T15. `DrizzlePromptRepository`
  - Type: infrastructure
  - Depends on: T6, T13
  - Red: `tests/integration/modules/prompt/infrastructure/persistence/DrizzlePromptRepository.test.ts` (ported from `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`, import paths updated) — `findAll` (joined with category, most-recent-first, category filter, non-UUID filter returns empty, empty-table case, absent-description representation), `findById` (joined match, not-found, non-UUID, absent description), `create` (persists row, with/without description), `update` (persists changed fields, absent description), `delete` (removes row). Fails: class doesn't exist.
  - Green: create `src/modules/prompt/infrastructure/persistence/DrizzlePromptRepository.ts`, preserving both `::text` casts and the manual partial-update `.set()` verbatim; same `DrizzleDatabaseConnection` typing as T14.
  - Covers: V1, V2, V4 (AC2, AC3, AC4, AC6, AC8)

- [ ] T16. Prompt module composition root
  - Type: infrastructure
  - Depends on: T3, T7, T8, T9, T10, T11, T12, T14, T15
  - Red: none — `services.ts` is pure composition.
  - Green: create `src/modules/prompt/services.ts` — one shared `db` const from `databaseClient.connect()`, both repositories, all 6 use cases, `CreatePromptUseCase`/`UpdatePromptUseCase` additionally wired with `dateTimeService`/`idGenerator`, all imported from `@src/modules/shared/services.js`.
  - Covers: V6 (makes AC1–AC8 reachable from one entry point)

- [ ] T17. Enforce boundaries for the new context
  - Type: infrastructure
  - Depends on: T16
  - Red: none — config change. Verify by temporarily adding a deliberately illegal import (e.g. `src/modules/prompt/application/GetPromptUseCase.ts` importing directly from `src/modules/prompt/infrastructure/persistence/DrizzlePromptRepository.ts`), confirming `npm run lint` reports a boundary violation, then removing it.
  - Green: edit `.eslintrc.json`'s `boundaries/elements` — change the `domain`/`application`/`infrastructure` entries' `pattern` from a single string to an array that also matches `src/modules/*/{domain,application,infrastructure}`.
  - Covers: V6

- [ ] T18. Full-suite verification
  - Type: infrastructure
  - Depends on: T1–T17
  - Red: none — verification step, no new behavior.
  - Green: run `npm run lint`, `npm run typecheck`, `npm test` (all green); run `npx drizzle-kit generate` and confirm no new SQL file is produced; confirm `src/logic/prompt/**`, `src/handlers/**`, `src/config.ts`, and every pre-existing test file are unchanged.
  - Covers: V7, V8 (AC9)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given the rebuilt implementation, When categories are listed, Then the same categories are returned as `001-list-categories` describes. | T7, T14, T16 |
| AC2 | Given the rebuilt implementation, When prompts are listed, optionally filtered by category, Then the same prompts are returned as `002-list-prompts` describes — including a category filter that is malformed or matches no category simply returning no results, never an error. | T8, T15, T16 |
| AC3 | Given the rebuilt implementation, When a single prompt is retrieved by id, Then the same prompt is returned, or the prompt-not-found error (E2) is raised if it doesn't exist, exactly as `003-get-prompt` describes. | T9, T15, T16 |
| AC4 | Given the rebuilt implementation, When a prompt is created with a title, prompt text, an existing category, and an optional description, Then a new prompt is created with a self-assigned unique identifier and creation/last-updated moment, as `005-create-prompt` describes. | T11, T15, T16 |
| AC5 | Given the rebuilt implementation, When a prompt is created against a category reference that doesn't exist, Then the category-invalid error (E1) is raised and no prompt is created, as `005-create-prompt` describes. | T11 |
| AC6 | Given the rebuilt implementation, When an existing prompt is updated, Then its fields are updated and its last-updated moment is refreshed by the capability itself, as `006-update-prompt` describes. | T12, T15, T16 |
| AC7 | Given the rebuilt implementation, When an update targets a prompt or a category that doesn't exist, Then the prompt-not-found error (E2) or the category-invalid error (E1) is raised respectively and nothing is changed, as `006-update-prompt` describes. | T12 |
| AC8 | Given the rebuilt implementation, When an existing prompt is deleted, Then it no longer exists; When a nonexistent prompt is targeted, Then the prompt-not-found error (E2) is raised, as `007-delete-prompt` describes. | T10, T15, T16 |
| AC9 | Given this work is complete, When the existing implementation and everything that depends on it are inspected, Then they are unchanged and their tests still pass; When the project's automated quality checks are run, Then all of them pass and no change to stored data is required. | T17, T18 |
