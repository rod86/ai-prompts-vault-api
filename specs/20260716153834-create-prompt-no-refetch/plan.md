# Plan: Create prompt without re-reading the created prompt
Spec: specs/20260716153834-create-prompt-no-refetch/spec.md

## 1. Approach

`CreatePromptUseCase.invoke()` (`src/modules/prompt/application/CreatePromptUseCase.ts`)
currently inserts the prompt and then re-reads it via `promptRepository.findById()` to
obtain the full `Prompt` — the only datum it lacks is the creator's **name**
(`Prompt.user` is `{ id, name }`; the query carries only `userId`; the name comes from
the re-read's JOIN with `users` in `DrizzlePromptRepository.findById`).

The change: add a small user-lookup port to the prompt context (mirroring the existing
`PromptCategoryRepositoryInterface` pattern), fetch the creator's `{ id, name }` before
the insert, and assemble the returned `Prompt` from the category, the creator, the query
data, and the generated id/timestamps. The post-insert re-read and its "Prompt not found
immediately after being created" failure path (`CreatePromptUseCase.ts:52-59`) are
removed. A missing creator raises a new `UserNotFoundError` domain error (spec decision
2). The HTTP layer (`src/handlers/prompts/createPromptHandler.ts`, routes, schemas) is
untouched; the wire contract is unchanged except that the (practically unreachable)
missing-creator anomaly now surfaces as 422 `USER_NOT_FOUND` instead of a 500.

Reused patterns: port + Drizzle adapter shape from
`PromptCategoryRepositoryInterface` / `DrizzlePromptCategoryRepository`; `findById`
query shape from
`src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts` (selects
from `users` with `eq(users.id, id)`, `limit(1)`); `DomainError` subclass shape from
`src/modules/prompt/domain/errors/CategoryNotFoundError.ts`.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `Prompt` domain types | existing | `src/modules/prompt/domain/Prompt.ts` | Add exported `PromptUser = { id: string; name: string }`; reuse it as the type of `Prompt.user` |
| `PromptUserRepositoryInterface` | new | `src/modules/prompt/domain/interfaces/PromptUserRepositoryInterface.ts` | Default-exported port: `findById(id: string): Promise<PromptUser \| undefined>` (mirrors `PromptCategoryRepositoryInterface`) |
| `UserNotFoundError` | new | `src/modules/prompt/domain/errors/UserNotFoundError.ts` | `DomainError` subclass — `code = 'USER_NOT_FOUND'`, `category = 'Unprocessable'`, message `` `User not found: ${id}` `` (mirrors `CategoryNotFoundError`) |
| `CreatePromptUseCase` | existing | `src/modules/prompt/application/CreatePromptUseCase.ts` | Inject the new port (after `categoryRepository`); fetch creator after the category check, throw `UserNotFoundError` if absent; assemble and return the `Prompt`; delete the post-insert `findById` re-read and second `PromptCreationError` throw |
| `DrizzlePromptUserRepository` | new | `src/modules/prompt/infrastructure/database/DrizzlePromptUserRepository.ts` | Adapter over the users table: constructor `(database: DatabaseClientInterface<DatabaseConnection>, schema: UserSchema)`; select `{ id, name }` where `eq(users.id, id)`, `limit(1)` |
| Prompt context composition root | existing | `src/modules/prompt/services.ts` | Instantiate `DrizzlePromptUserRepository(databaseClient, schema)` and pass it to `CreatePromptUseCase` |

No change to `errorMiddleware`/`domainErrorStatus` — `UserNotFoundError` reuses the
existing `Unprocessable → 422` category mapping (CLAUDE.md: a new business error reusing
an existing category needs no middleware edit).

## 3. Interfaces & contracts

- `PromptUser` (domain type): `{ id: string; name: string }` — also the existing shape
  of `Prompt.user`.
- `PromptUserRepositoryInterface` (port): `findById(id: string): Promise<PromptUser | undefined>`.
- `CreatePromptUseCase` constructor becomes
  `(promptRepository, categoryRepository, userRepository, dateTime, idGenerator)`.
- `CreatePromptQuery` and the returned `Promise<Prompt>` are unchanged; the HTTP
  request/response shapes are unchanged (AC7).
- Invoke flow: category lookup → `CategoryNotFoundError` if absent → user lookup →
  `UserNotFoundError` if absent → generate id + `now` → `promptRepository.create(...)`
  in the existing try/catch (`PromptCreationError` wrapping the cause) → return the
  assembled `Prompt` (`createdAt`/`updatedAt` = the same `now` stored on insert, so the
  result equals the stored row).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `CategoryNotFoundError` (existing) | 422 `{ status: 422, code: 'CATEGORY_NOT_FOUND', message: 'Category not found: <id>' }` |
| E2 | `UserNotFoundError` (new) | 422 `{ status: 422, code: 'USER_NOT_FOUND', message: 'User not found: <id>' }` |
| E3 | `PromptCreationError` (existing, plain `Error`) | 500 `{ status: 500, code: 'INTERNAL_ERROR', message: … }`; cause logged server-side only |

## 4. Data & persistence

None. The new adapter only reads the existing `users` table (already part of the
centralized schema and of `UserSchema` in `src/config/drizzle/index.ts`). No migration.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Referenced category exists | `CreatePromptUseCase` via `promptCategoryRepository.findById` (existing, unchanged) | → E1 |
| V2 | Creator exists as a registered user | `CreatePromptUseCase` via the new `PromptUserRepositoryInterface.findById` | → E2 |

## 6. Dependency changes

None.

## 7. Assumptions & risks

Assumptions:
1. Category is checked before the creator, so when both are unknown the user sees E1 —
   matches the existing check order. Consequence if wrong: swap the two lookups.
2. Error code `USER_NOT_FOUND` and message `User not found: <id>`, mirroring
   `CATEGORY_NOT_FOUND`. Consequence if wrong: rename the code/message (client-facing).
3. The assembled prompt's `createdAt`/`updatedAt` are the single `now` from
   `dateTime.now()` — identical to what the insert stores today, so AC1/AC7 hold with
   no value drift. Consequence if wrong: timestamps in the response differ from storage.
4. The port lives in the prompt context (not a cross-context import of the user
   context's repository), per the boundary rules enforced by `eslint-plugin-boundaries`.
   Consequence if wrong: lint failure.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A race (user deleted between lookup and insert) still hits the users FK on insert | low | Insert fails → E3 (500), same as today | Existing try/catch already wraps it in `PromptCreationError`; AC5 pins it |
| R2 | Existing consumers relied on the 500 for the missing-creator anomaly | low | Contract change 500 → 422 for an unreachable-in-practice case | Explicitly decided (spec decision 2); documented in spec §4 |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No description | valid creation without a description | Assembled prompt has no description | AC6 |
| Unknown category and unknown creator | neither exists | E1 (category checked first); creator never looked up | AC3 |
| Creator vanished after auth | auth passed, user row gone at lookup | E2, nothing stored | AC4 |
| Storage rejects insert (e.g. connection lost, FK race) | `create` rejects | E3 wrapping the cause | AC5 |
| End-to-end API creation | authenticated POST with valid data | Same 201 body as before the change, creator name included | AC7 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 / E1 / AC3 | §5 V1 row; existing category check in `CreatePromptUseCase` (§2, §3 flow) |
| V2 / E2 / AC4 | §5 V2 row; new port + `UserNotFoundError` + use-case check (§2, §3) |
| E3 / AC5 | Existing try/catch around `promptRepository.create` kept (§3 flow, R1) |
| AC1, AC2 | Assembled return value; re-read deleted (§1, §3 flow) |
| AC6 | Assembly passes `query.description` through unchanged (§8 no-description case) |
| AC7 | HTTP layer untouched; timestamps assumption 3 (§1, §7) |
| creator field | `PromptUser` type + port + adapter (§2, §3) |
