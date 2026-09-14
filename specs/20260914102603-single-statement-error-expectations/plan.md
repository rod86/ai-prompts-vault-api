# Plan: Single-statement error expectations in tests
Spec: specs/20260914102603-single-statement-error-expectations/spec.md

## 1. Approach

A test-only refactor. Every `rejects.toThrow(<ErrorClass>)` / `toThrow(<ErrorClass>)` in
`tests/` is replaced by `toThrow(new <ErrorClass>(<same args the production code passes>))`,
and where a second `toThrow('<message>')` statement followed it, that statement is deleted.
No file under `src/` changes.

This is already the documented convention: the `testing-practices` skill's **Errors**
section specifies exactly this form, including the no-argument case
(`toThrow(new InvalidCredentialsError())`). Two assertions in
`tests/unit/modules/auth/application/LoginUseCase.test.ts` (lines 58, 73) already follow
it and serve as the reference shape; this spec brings the other 17 sites in line.

**Why the instance form proves both kind and wording.** Vitest's `toThrow` branches on the
argument type (`node_modules/@vitest/expect/dist/index.js:1549`). A class argument asserts
only `instanceof`; a **string** argument asserts only a message substring; an **Error
instance** routes to `isErrorEqual`, which compares `name`, `message`, `cause` (only when
the *expected* instance carries one) and the enumerable own properties of both. Since
`DomainError` sets `this.name = new.target.name` and each non-domain error sets `this.name`
explicitly, comparing `name` is an effective kind check, and `code`/`category` class fields
are compared as enumerable own properties on top. That same `isErrorEqual` behavior is why
`cause`-carrying tests stay as they are (spec §1, V5): it compares `cause` by deep
equality, where those tests require identity via `toBe`.

`toThrow` also fails when nothing is thrown at all, so a green run after each edit is
itself proof the rewritten expectation is not vacuous — no separate mutation step is
needed.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| GetPromptUseCase test | existing | `tests/unit/modules/prompt/application/GetPromptUseCase.test.ts` | Collapse the type+message pair at lines 40–43 into `new PromptNotFoundError('missing-id')` |
| CreatePromptUseCase test | existing | `tests/unit/modules/prompt/application/CreatePromptUseCase.test.ts` | Collapse lines 94–97 → `new CategoryNotFoundError(query.categoryId)`; lines 138–139 → `new UserNotFoundError(query.userId)`. Lines 126–129 (`PromptCreationError` cause) untouched |
| UpdatePromptUseCase test | existing | `tests/unit/modules/prompt/application/UpdatePromptUseCase.test.ts` | Collapse lines 92–93 → `new PromptNotFoundError(query.id)`; lines 105–108 → `new CategoryNotFoundError(query.categoryId)`; tighten line 189 → `new PromptOwnershipError(query.id)`. Lines 178–181 (`PromptUpdateError` cause) untouched |
| DeletePromptUseCase test | existing | `tests/unit/modules/prompt/application/DeletePromptUseCase.test.ts` | Collapse lines 50–51 → `new PromptNotFoundError(id)`; tighten lines 60–62 → `new PromptOwnershipError(existingPrompt.id)` |
| RegisterUserUseCase test | existing | `tests/unit/modules/user/application/RegisterUserUseCase.test.ts` | Collapse lines 107–108 → `new EmailAlreadyInUseError(query.email)`; tighten line 119 → `new WeakPasswordError()`. Lines 96–99 (`UserCreationError` cause) untouched |
| ValidateTokenUseCase test | existing | `tests/unit/modules/auth/application/ValidateTokenUseCase.test.ts` | Tighten line 42 → `new InvalidTokenError()` |
| JwtTokenVerifier test | existing | `tests/integration/modules/auth/infrastructure/security/JwtTokenVerifier.test.ts` | Tighten line 27 → `new TokenExpiredError()`; lines 36, 40, 46 → `new InvalidTokenError()` |
| DatabaseClient test | existing | `tests/unit/modules/shared/infrastructure/database/DatabaseClient.test.ts` | Tighten the synchronous lines 62, 78 → `new DatabaseNotConnectedError()` |
| LoginUseCase test | existing | `tests/unit/modules/auth/application/LoginUseCase.test.ts` | **No change** — lines 58, 73 already use the target form; verified only |

Error classes consulted for their constructor signature and wording (all read, none
changed): `PromptNotFoundError`, `PromptOwnershipError`, `CategoryNotFoundError`,
`UserNotFoundError` (`src/modules/prompt/domain/errors/`), `EmailAlreadyInUseError`,
`WeakPasswordError` (`src/modules/user/domain/errors/`), `InvalidTokenError`,
`TokenExpiredError`, `InvalidCredentialsError` (`src/modules/auth/domain/errors/`),
`DatabaseNotConnectedError`
(`src/modules/shared/infrastructure/database/DatabaseNotConnectedError.ts`).

Every error class is already imported in the file that asserts it, so the conversion
changes no import statement — the identifier simply moves from a bare reference to a `new`
expression. `npm run lint` confirms nothing became unused.

## 3. Interfaces & contracts

No production interface changes. The single assertion shape, in both forms:

```ts
// asynchronous (use cases, verifiers)
await expect(useCase.invoke(query)).rejects.toThrow(new PromptNotFoundError(query.id));

// synchronous (DatabaseClient)
expect(() => client.getConnection()).toThrow(new DatabaseNotConnectedError());

// no-argument constructor — instance still carries the hardcoded wording
await expect(useCase.invoke(TOKEN)).rejects.toThrow(new InvalidTokenError());
```

Constructor argument per site, matched to the value the production code throws with:

| Error | Thrown at | Expectation argument in the test |
|--|--|--|
| `PromptNotFoundError` | `GetPromptUseCase.ts:16`, `UpdatePromptUseCase.ts:30`, `DeletePromptUseCase.ts:17` — `query.id` | the identifier the test arranged (`'missing-id'`, `query.id`, `id`) |
| `PromptOwnershipError` | `UpdatePromptUseCase.ts:34`, `DeletePromptUseCase.ts:21` — `query.id` | `query.id` / `existingPrompt.id` (the same value) |
| `CategoryNotFoundError` | `CreatePromptUseCase.ts:32`, `UpdatePromptUseCase.ts:43` — `query.categoryId` | `query.categoryId` |
| `UserNotFoundError` | `CreatePromptUseCase.ts:38` — `query.userId` | `query.userId` |
| `EmailAlreadyInUseError` | `RegisterUserUseCase.ts:42` — `query.email` | `query.email` |
| `WeakPasswordError`, `InvalidTokenError`, `TokenExpiredError`, `DatabaseNotConnectedError` | no-argument constructors | none |

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | none — this is a developer-facing assertion failure, not a product error | Vitest reports one failed assertion with the full expected error object diffed against the actual one; a never-thrown error is reported as "expected promise to throw an error, but it didn't" |

## 4. Data & persistence

None. No schema, table, or migration is touched, and no test's database fixtures change.
`JwtTokenVerifier.test.ts` and `DatabaseClient.test.ts` are the only non-unit files in
scope and neither uses a fixture.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Expectation carries kind **and** wording | Each converted assertion passes an `Error` instance, routing Vitest to `isErrorEqual` (`name` + `message` + own fields) rather than the class-only or string-only branch | → E1 |
| V2 | One expectation per expected failure; operation exercised once | Each converted site is a single `await expect(...)` statement; the duplicated second `toThrow` statement is deleted so `invoke` runs once | → E1 |
| V3 | Wording comes from the failure's own definition | The expectation constructs the real error class; no message string literal remains at any converted site. Constructors that take no message argument are rejected by `tsc` if one is passed | → E1 |
| V4 | Identifying information is the value the test arranged | Constructor arguments taken from the test's own `query` / fixture variables per the §3 table, never re-generated | → E1 |
| V5 | Cause-carrying failures still prove identity | The three `.catch()` + `toBeInstanceOf` + `expect(...cause).toBe(...)` sites are left untouched | → E1 |
| V6 | Applies to sync, async, business and technical failures alike | `DatabaseClient.test.ts` (sync, technical) and `JwtTokenVerifier.test.ts` (async, infrastructure) are in scope alongside the use-case tests | → E1 |

## 6. Dependency changes

None.

## 7. Assumptions & risks

Assumptions:
1. `existingPrompt.id` and `query.id` are the same value at `DeletePromptUseCase.test.ts:60`
   and `UpdatePromptUseCase.test.ts:189` (the query is built from the prompt), so either
   spelling asserts the same thing; the plan uses whichever variable is already in the
   test's local scope — consequence if wrong: the assertion fails loudly on the first run,
   pointing at the mismatched identifier.
2. `it` titles stay as they are — they already describe the behavior in plain language and
   name no assertion mechanics — consequence if wrong: nothing; titles are independent of
   the assertion shape.
3. No test file needs an import added or removed, since every error class asserted is
   already imported where it is used — consequence if wrong: `npm run lint` reports the
   unused or undefined identifier immediately.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A tightened kind-only site fails because the real wording differs from what the test's constructor argument produces | med | The task's test run goes red | That is the point of the tightening — the failure names the true wording; fix the argument to the value the production code throws with (§3 table), never the reverse |
| R2 | Removing the duplicated statement halves the number of times the operation runs, breaking a follow-up call-count expectation | low | A neighbouring assertion in the same test fails | Every follow-up expectation at the affected sites is `not.toHaveBeenCalled()`, which only gets easier with fewer invocations; verified by reading all 8 files |
| R3 | A converted expectation silently matches a *different* error class that happens to share a name and fields | low | A false green | Accepted: `isErrorEqual` compares `name`, which is derived from the class name, so a collision requires two identically-named classes — none exist in this codebase |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No-argument constructor | `InvalidTokenError`, `TokenExpiredError`, `WeakPasswordError`, `DatabaseNotConnectedError` | Constructed with `()`; the instance carries its hardcoded wording, so kind and wording are both asserted | AC5, AC6, AC7, AC8 |
| Synchronous throw | `client.getConnection()` before `connect()` | `expect(() => ...).toThrow(new DatabaseNotConnectedError())` — the non-promise branch of the same matcher | AC8 |
| Non-`DomainError` class | `DatabaseNotConnectedError extends Error` with an explicit `this.name` | Compared the same way; `name` is set, so the kind check holds | AC8 |
| Template-literal wording | `Prompt not found: ${id}` | Constructor receives the identifier; the wording is produced by the error, not spelled out in the test | AC1, AC3, AC4 |
| Already-converted site | `LoginUseCase.test.ts:58,73` | Left exactly as-is; used as the reference shape | AC10 |
| Cause-carrying failure | `PromptCreationError`, `PromptUpdateError`, `UserCreationError` | Left exactly as-is; identity of the cause still proven with `toBe` | AC9 |
| Follow-up call-count expectation after a collapsed pair | e.g. `expect(promptRepository.delete).not.toHaveBeenCalled()` | Still holds — and is now stricter, since the operation ran once rather than twice | AC2, AC3, AC4, AC5 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| V1 | §1 (why the instance form proves kind + wording), §3 assertion shapes, §5 V1 |
| V2 | §2 "Collapse …" changes, §5 V2, §8 follow-up call-count row |
| V3 | §3 constructor-argument table, §5 V3 |
| V4 | §3 constructor-argument table, §7 assumption 1, §5 V4 |
| V5 | §1 (`isErrorEqual` compares `cause` by deep equality), §2 "untouched" notes, §5 V5, §8 cause-carrying row |
| V6 | §2 `DatabaseClient` / `JwtTokenVerifier` rows, §5 V6, §8 synchronous + non-`DomainError` rows |
| E1 | §3 error/response table |
| AC1 | §2 GetPromptUseCase row |
| AC2 | §2 CreatePromptUseCase row |
| AC3 | §2 UpdatePromptUseCase row |
| AC4 | §2 DeletePromptUseCase row |
| AC5 | §2 RegisterUserUseCase row |
| AC6 | §2 ValidateTokenUseCase row |
| AC7 | §2 JwtTokenVerifier row |
| AC8 | §2 DatabaseClient row, §8 synchronous + non-`DomainError` rows |
| AC9 | §2 "untouched" notes on CreatePromptUseCase / UpdatePromptUseCase / RegisterUserUseCase, §5 V5 |
| AC10 | §2 LoginUseCase row, §6 (no new tooling), final verification task |
