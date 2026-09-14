# Tasks: Single-statement error expectations in tests
Plan: specs/20260914102603-single-statement-error-expectations/plan.md

> **On the Red step.** This story's deliverable *is* test code, so there is no production
> behavior to drive red-first — the classic red→green loop does not apply, and faking one
> would mean breaking `src/` on purpose. Each task's Red field therefore records the proof
> that the rewritten expectation is not vacuous: `toThrow` fails when nothing is thrown,
> and the instance branch fails on any `name`/`message`/own-field mismatch, so a green run
> of the touched file immediately after the edit proves the stricter assertion genuinely
> holds. Tasks are ordered leaf-first (unit, then integration, then whole-suite
> verification); none depends on a later one.

- [x] T1. Prompt read: collapse the not-found pair
  - Type: application (test)
  - Depends on: none
  - Red: none in the classic sense — this is a test-only refactor. Run
    `npx vitest run tests/unit/modules/prompt/application/GetPromptUseCase.test.ts` right
    after the edit; it must be green, which proves the single expectation still catches the
    thrown error and matches its wording. See the note above.
  - Green: in `tests/unit/modules/prompt/application/GetPromptUseCase.test.ts`, replace the
    two statements at lines 40–43 with
    `await expect(useCase.invoke({ id: 'missing-id' })).rejects.toThrow(new PromptNotFoundError('missing-id'));`
  - Covers: AC1 "Given a request to read a prompt that does not exist, When the read is
    exercised, Then one expectation proves the failure is a *prompt not found* failure whose
    wording names the requested identifier."; V1, V2, V3, V4

- [x] T2. Prompt creation: collapse the category and creator pairs
  - Type: application (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts` after
    the edit; green proves both expectations still catch their errors, and the surviving
    `not.toHaveBeenCalled()` follow-ups now hold against a single invocation.
  - Green: in `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts`, replace
    lines 94–97 with `.rejects.toThrow(new CategoryNotFoundError(query.categoryId))` and
    lines 138–139 with `.rejects.toThrow(new UserNotFoundError(query.userId))`, each as one
    statement. Leave the `PromptCreationError` cause assertions (lines 126–129) untouched.
  - Covers: AC2 "Given a request to create a prompt naming a category that does not exist,
    and separately a request naming a creator that does not exist, When each is exercised,
    Then one expectation each proves the failure is a *category not found* / *creator not
    found* failure whose wording names the offending identifier, and the follow-up
    expectations that nothing was persisted and no further lookup happened still hold.";
    V1, V2, V3, V4

- [x] T3. Prompt update: collapse two pairs and tighten the ownership check
  - Type: application (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` after
    the edit; green proves the tightened ownership assertion matches the real wording, not
    just the class.
  - Green: in `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts`, replace
    lines 92–93 with `.rejects.toThrow(new PromptNotFoundError(query.id))`, lines 105–108
    with `.rejects.toThrow(new CategoryNotFoundError(query.categoryId))`, and line 189 with
    `.rejects.toThrow(new PromptOwnershipError(query.id))`. Leave the `PromptUpdateError`
    cause assertions (lines 178–181) untouched.
  - Covers: AC3 "Given a request to update a prompt that does not exist, a request whose
    category does not exist, and a request from someone who is not the prompt's owner, When
    each is exercised, Then one expectation each proves the failure is the *prompt not
    found* / *category not found* / *not the owner* failure whose wording names the
    offending identifier, and the follow-up expectations that nothing was looked up,
    persisted, or timestamped still hold."; V1, V2, V3, V4, V6

- [x] T4. Prompt deletion: collapse the not-found pair and tighten the ownership check
  - Type: application (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/unit/modules/prompt/application/DeletePromptUseCase.test.ts` after
    the edit; green proves both expectations hold and `delete` is still never called.
  - Green: in `tests/unit/modules/prompt/application/DeletePromptUseCase.test.ts`, replace
    lines 50–51 with `.rejects.toThrow(new PromptNotFoundError(id))` and lines 60–62 with
    `.rejects.toThrow(new PromptOwnershipError(existingPrompt.id))`.
  - Covers: AC4 "Given a request to delete a prompt that does not exist, and a request from
    someone who is not the prompt's owner, When each is exercised, Then one expectation each
    proves the failure is the *prompt not found* / *not the owner* failure whose wording
    names the offending identifier, and the follow-up expectation that nothing was deleted
    still holds."; V1, V2, V3, V4, V6

- [x] T5. User registration: collapse the duplicate-email pair and tighten the weak-password check
  - Type: application (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/unit/modules/user/application/RegisterUserUseCase.test.ts` after
    the edit; green proves the tightened weak-password assertion matches its real wording.
  - Green: in `tests/unit/modules/user/application/RegisterUserUseCase.test.ts`, replace
    lines 107–108 with `.rejects.toThrow(new EmailAlreadyInUseError(query.email))` and line
    119 with `.rejects.toThrow(new WeakPasswordError())`. Leave the `UserCreationError`
    cause assertions (lines 96–99) untouched.
  - Covers: AC5 "Given a registration whose email is already taken, and separately one whose
    password is too weak, When each is exercised, Then one expectation each proves the
    failure is the *email already in use* failure whose wording names that email / the
    *password too weak* failure with its wording, and the follow-up expectations that
    nothing was hashed, persisted, timestamped, or looked up still hold."; V1, V2, V3, V4, V6

- [x] T6. Token validation: tighten the unknown-user check
  - Type: application (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/unit/modules/auth/application/ValidateTokenUseCase.test.ts` after
    the edit; green proves the added wording check holds.
  - Green: in `tests/unit/modules/auth/application/ValidateTokenUseCase.test.ts`, replace
    line 42 with `await expect(useCase.invoke(TOKEN)).rejects.toThrow(new InvalidTokenError());`
  - Covers: AC6 "Given a token that identifies no existing user, When it is validated, Then
    one expectation proves the failure is the *invalid token* failure with its wording.";
    V1, V3, V6

- [x] T7. Token verification: tighten all four rejection checks
  - Type: infrastructure (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/integration/modules/auth/infrastructure/security/JwtTokenVerifier.test.ts`
    after the edit; green proves each added wording check matches what the verifier actually
    throws, and that expiry is still distinguished from invalidity.
  - Green: in
    `tests/integration/modules/auth/infrastructure/security/JwtTokenVerifier.test.ts`,
    replace line 27 with `.rejects.toThrow(new TokenExpiredError())` and lines 36, 40 and 46
    with `.rejects.toThrow(new InvalidTokenError())`.
  - Covers: AC7 "Given an expired token, a token signed with the wrong secret, an unreadable
    token, and a token carrying no subject, When each is verified, Then one expectation each
    proves the failure is the *token expired* / *invalid token* failure with its wording.";
    V1, V3, V6

- [x] T8. Data store client: tighten both not-connected checks
  - Type: infrastructure (test)
  - Depends on: none
  - Red: none in the classic sense — run
    `npx vitest run tests/unit/modules/shared/infrastructure/database/DatabaseClient.test.ts`
    after the edit; green proves the synchronous branch of the matcher accepts the instance
    form and that the wording matches.
  - Green: in `tests/unit/modules/shared/infrastructure/database/DatabaseClient.test.ts`,
    replace lines 62 and 78 with
    `expect(() => client.getConnection()).toThrow(new DatabaseNotConnectedError());`
  - Covers: AC8 "Given a data store connection that has never been established, and
    separately one that has been released, When a connection is requested, Then one
    expectation each proves the failure is the *not connected* failure with its wording.";
    V1, V3, V6

- [ ] T9. Verify the untouched cause-carrying tests and the whole suite
  - Type: verification
  - Depends on: T1, T2, T3, T4, T5, T6, T7, T8
  - Red: none in the classic sense — this task adds no test; it proves the refactor left the
    suite green and complete. Run `npm test`, `npm run lint` and `npm run typecheck`; all
    three must pass. Then re-grep `tests/` for `toThrow(` and confirm every remaining
    occurrence is either an instance form, a `not.toThrow()` schema-shape assertion, or one
    of the three untouched `toBeInstanceOf` + `.cause` sites — no bare class argument and no
    bare message string remains.
  - Green: no edit expected. If the grep finds a missed site, convert it per the plan's §3
    constructor-argument table; if `lint` reports an import that became unused, remove it.
  - Covers: AC9 "Given the tests that prove a create or update failure wraps the underlying
    cause it was given, When the suite runs, Then those tests are unchanged and still prove
    the carried cause is the identical one supplied."; AC10 "Given the whole test suite,
    When it is run together with the project's linting and type checking, Then all three
    pass and no failure expectation anywhere states a kind without its wording or a wording
    without its kind."; V5

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a request to read a prompt that does not exist, When the read is exercised, Then one expectation proves the failure is a *prompt not found* failure whose wording names the requested identifier. | T1 |
| AC2 | Given a request to create a prompt naming a category that does not exist, and separately a request naming a creator that does not exist, When each is exercised, Then one expectation each proves the failure is a *category not found* / *creator not found* failure whose wording names the offending identifier, and the follow-up expectations that nothing was persisted and no further lookup happened still hold. | T2 |
| AC3 | Given a request to update a prompt that does not exist, a request whose category does not exist, and a request from someone who is not the prompt's owner, When each is exercised, Then one expectation each proves the failure is the *prompt not found* / *category not found* / *not the owner* failure whose wording names the offending identifier, and the follow-up expectations that nothing was looked up, persisted, or timestamped still hold. | T3 |
| AC4 | Given a request to delete a prompt that does not exist, and a request from someone who is not the prompt's owner, When each is exercised, Then one expectation each proves the failure is the *prompt not found* / *not the owner* failure whose wording names the offending identifier, and the follow-up expectation that nothing was deleted still holds. | T4 |
| AC5 | Given a registration whose email is already taken, and separately one whose password is too weak, When each is exercised, Then one expectation each proves the failure is the *email already in use* failure whose wording names that email / the *password too weak* failure with its wording, and the follow-up expectations that nothing was hashed, persisted, timestamped, or looked up still hold. | T5 |
| AC6 | Given a token that identifies no existing user, When it is validated, Then one expectation proves the failure is the *invalid token* failure with its wording. | T6 |
| AC7 | Given an expired token, a token signed with the wrong secret, an unreadable token, and a token carrying no subject, When each is verified, Then one expectation each proves the failure is the *token expired* / *invalid token* failure with its wording. | T7 |
| AC8 | Given a data store connection that has never been established, and separately one that has been released, When a connection is requested, Then one expectation each proves the failure is the *not connected* failure with its wording. | T8 |
| AC9 | Given the tests that prove a create or update failure wraps the underlying cause it was given, When the suite runs, Then those tests are unchanged and still prove the carried cause is the identical one supplied. | T9 (with T2, T3, T5 explicitly leaving those sites untouched) |
| AC10 | Given the whole test suite, When it is run together with the project's linting and type checking, Then all three pass and no failure expectation anywhere states a kind without its wording or a wording without its kind. | T9 |
