# Tasks: Create prompt without re-reading the created prompt
Plan: specs/20260716153834-create-prompt-no-refetch/plan.md

- [x] T1. `PromptUser` type + user-lookup port
  - Type: domain
  - Depends on: none
  - Red: none — `src/modules/prompt/domain/Prompt.ts` (type addition) and
    `src/modules/prompt/domain/interfaces/PromptUserRepositoryInterface.ts` are pure
    type/interface declarations; see testing-practices
  - Green: add `export type PromptUser = { id: string; name: string }` to `Prompt.ts`
    and reuse it as the type of `Prompt.user`; create the default-exported
    `PromptUserRepositoryInterface` with `findById(id: string): Promise<PromptUser | undefined>`
    (mirror `PromptCategoryRepositoryInterface`)
  - Covers: creator field (plan §2/§3); groundwork for V2

- [x] T2. Drizzle user-lookup adapter — unknown user
  - Type: infrastructure
  - Depends on: T1
  - Red: new integration test
    `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptUserRepository.test.ts`
    (lifecycle copied from `DrizzlePromptCategoryRepository.test.ts`): `findById` with a
    random uuid that matches no user resolves `undefined`; fails because
    `DrizzlePromptUserRepository` does not exist
  - Green: create `src/modules/prompt/infrastructure/database/DrizzlePromptUserRepository.ts`
    implementing the port — constructor
    `(database: DatabaseClientInterface<DatabaseConnection>, schema: UserSchema)`,
    minimal `findById` that returns `undefined` when no row matches
  - Covers: V2 (lookup mechanics); supports AC4

- [x] T3. Drizzle user-lookup adapter — existing user
  - Type: infrastructure
  - Depends on: T2
  - Red: add to the T2 test file: insert a user via `createUserFixture()`, `findById`
    resolves exactly `{ id, name }` of that user; fails while the adapter never returns
    a populated result
  - Green: implement the real query — select `{ id: users.id, name: users.name }` where
    `eq(users.id, id)`, `limit(1)` (mirror `DrizzleUserCredentialsRepository.findById`)
  - Covers: V2 (lookup mechanics); supports AC1 (creator name in the assembled prompt)

- [x] T4. Use case rejects a missing creator
  - Type: application
  - Depends on: T1, T3
  - Red: new unit test in `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts`:
    category lookup resolves a category, user lookup resolves `undefined` → `invoke`
    rejects with `UserNotFoundError` and message `User not found: <userId>`, and
    `promptRepository.create` was not called; fails because the use case takes no user
    repository and `UserNotFoundError` does not exist
  - Green: create `src/modules/prompt/domain/errors/UserNotFoundError.ts`
    (`DomainError`, `code = 'USER_NOT_FOUND'`, `category = 'Unprocessable'` — no
    middleware change needed); inject `PromptUserRepositoryInterface` into
    `CreatePromptUseCase` (after `categoryRepository`) and throw when the lookup
    resolves `undefined`. Same-task mechanical repairs to keep everything compiling and
    green: pass `new DrizzlePromptUserRepository(databaseClient, schema)` in
    `src/modules/prompt/services.ts`, and in the unit test file add the
    `userRepository` mock to `beforeEach`/constructor and a found-user mock to the
    three existing tests that reach the lookup (both happy paths and the
    repository-rejection test, which must keep asserting `PromptCreationError` with the
    preserved `cause`)
  - Covers: AC4 "Given the creator's user record does not exist, when the user creates
    a prompt, then they receive the 'user not found' error (E2) and nothing is stored.";
    AC5 (existing rejection test adapted and kept green); V2, E2, E3

- [x] T5. Use case returns the assembled prompt without re-reading it
  - Type: application
  - Depends on: T4
  - Red: rewrite the happy-path unit test: drop the `promptRepository.findById` mock;
    assert the result equals the prompt assembled from the mocked category, the mocked
    creator `{ id, name }`, the query fields, `generatedId`, and `now` — and that
    `promptRepository.findById` was **never** called; fails while the use case still
    re-reads (unmocked `findById` resolves `undefined` → `PromptCreationError`)
  - Green: in `CreatePromptUseCase.invoke`, return the assembled `Prompt`
    (`{ id, category, user, title, prompt, description, createdAt: now, updatedAt: now }`)
    and delete the post-insert `findById` re-read and the second `PromptCreationError`
    throw
  - Covers: AC1 "Given an authenticated user, an existing category, and valid prompt
    data, when the user creates the prompt, then they receive the complete created
    prompt — identifier, title, prompt text, description, category id and name, creator
    id and name, and creation/update timestamps — matching exactly what was stored.";
    AC2 "Given a prompt creation succeeds, when the created prompt is returned, then it
    was assembled from the data already at hand and the stored prompt was not read back
    after being stored."

- [ ] T6. No-description creation still yields no description
  - Type: application
  - Depends on: T5
  - Red: adapt the existing "creates a prompt with no description unchanged" unit test:
    drop its `findById` mock and assert on the assembled result
    (`result.description` is `undefined`); before T5's green this fails the same way as
    T5's red — kept as a separate regression pin per acceptance criterion
  - Green: none expected beyond T5 — confirm the test passes against the assembled
    result
  - Covers: AC6 "Given valid prompt data with no description, when the user creates the
    prompt, then the created prompt they receive has no description."

- [ ] T7. Category-not-found precedence over the creator lookup
  - Type: application
  - Depends on: T4
  - Red: extend the existing category-not-found unit test with the assertion that the
    creator lookup (`userRepository.findById`) was never called; would fail if the
    creator were looked up before the category check (plan §7 assumption 1)
  - Green: none expected — the category check already precedes the lookup; confirm the
    assertions (`CategoryNotFoundError`, message, `create` not called) all hold
  - Covers: AC3 "Given a category that does not exist, when the user creates a prompt,
    then they receive the 'category not found' error (E1), nothing is stored, and the
    creator's details are not looked up."; V1, E1

- [ ] T8. End-to-end contract unchanged
  - Type: route handler
  - Depends on: T4, T5
  - Red: none — `tests/integration/handlers/prompts/createPromptHandler.test.ts`
    already pins the wire contract (201 body with creator id and name); run it
    unmodified
  - Green: none expected — the HTTP layer is untouched; the suite passing unchanged
    proves the contract
  - Covers: AC7 "Given an authenticated user creating a prompt end to end, when the
    creation succeeds, then the received prompt (shape and values, including the
    creator's name) is identical to what this flow returned before this change."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given an authenticated user, an existing category, and valid prompt data, when the user creates the prompt, then they receive the complete created prompt — identifier, title, prompt text, description, category id and name, creator id and name, and creation/update timestamps — matching exactly what was stored. | T5 (with T3 for the creator lookup) |
| AC2 | Given a prompt creation succeeds, when the created prompt is returned, then it was assembled from the data already at hand and the stored prompt was **not** read back after being stored. | T5 |
| AC3 | Given a category that does not exist, when the user creates a prompt, then they receive the "category not found" error (E1), nothing is stored, and the creator's details are not looked up. | T7 |
| AC4 | Given the creator's user record does not exist, when the user creates a prompt, then they receive the "user not found" error (E2) and nothing is stored. | T4 (with T2 for the lookup's miss path) |
| AC5 | Given storage rejects the creation, when the user creates a prompt, then the creation fails as a generic internal failure (E3) preserving the underlying cause internally. | T4 (existing rejection test adapted and kept green) |
| AC6 | Given valid prompt data with no description, when the user creates the prompt, then the created prompt they receive has no description. | T6 |
| AC7 | Given an authenticated user creating a prompt end to end, when the creation succeeds, then the received prompt (shape and values, including the creator's name) is identical to what this flow returned before this change. | T8 |
