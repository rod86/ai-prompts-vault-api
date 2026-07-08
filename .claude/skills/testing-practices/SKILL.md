---
name: testing-practices
description: Testing conventions for this TypeScript backend — the TDD loop, test file structure and placement, unit vs integration tests, model factories, mocking strategy, error assertions, the database test lifecycle, and request-validation tests. Use when writing, reviewing, or structuring any test, adding a model factory, deciding unit vs integration, or mocking a dependency.
---

# Testing Practices

All tests live under `tests/` (never inside `src/`). TDD is mandatory. The stack is
Vitest as the runner, supertest for HTTP assertions, vitest-mock-extended for typed
mocks, and `@faker-js/faker` for fake data.

## Quick rules

- Tests live under `tests/`, never in `src/`; mirror the `src/` path; suffix `.test.ts`.
- TDD every change: red → green → refactor.
- **Use cases (application layer) → unit test, all dependencies mocked. Adapters
  (infrastructure layer) + routes/handlers → integration test, against a real DB/HTTP.**
- Mock the dependency **type** (`mock<T>()`), never a hand-rolled fake.
- Structure every test as Arrange / Act / Assert; no `try/catch` in tests — use hooks.
- Build fake domain objects with model factories, not object literals.
- Filter DB assertions to the test's own fixture ids — parallel test files share tables.

## Running tests

```bash
npm test                                   # full run (vitest run, single pass)
npx vitest run tests/unit/.../X.test.ts    # one file
npx vitest run -t 'returns 404'            # filter by test name
npx vitest                                 # watch mode (TDD loop)
```

## TDD loop

1. Red — smallest failing test for the next item in `tasks.md`.
2. Green — minimum code to pass.
3. Refactor — clean up, keep the bar green.

## Structure

```
tests/
  lib/            # Shared test helpers (database, mocks, builders, sample responses,...)
    config.ts     # Test databaseClient + TestDatabaseConnection type, and singleton model factories, imported by tests.
    modelFactories # One factory per domain type, building fake instances of it.
    database      # Helpers to insert/select/delete rows directly, one file per table schema (e.g. `prompts.ts`)
  unit/           # Unit tests
  integration/    # Integration tests
```

The example test files cited throughout this skill live at their mirrored `src/` path
under `tests/unit/` or `tests/integration/` — e.g.
`tests/unit/logic/prompt/application/ListPromptsUseCase.test.ts` and
`tests/integration/logic/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`.

## Conventions

- Mirror the `src/` path under `tests/unit/` or `tests/integration`. Example:
  `src/logic/prompt/application/CreatePromptUseCase.ts` ->
  `tests/unit/logic/prompt/application/CreatePromptUseCase.test.ts`.
- Routes mirror `src/handlers/` the same way: one test file per handler, named
  after it, under `tests/integration/handlers/`. Example:
  `src/handlers/GetPromptsHandler.ts` ->
  `tests/integration/handlers/GetPromptsHandler.test.ts`. Don't collect
  multiple routes' tests into one shared file (e.g. a single `app.test.ts`) —
  it grows unbounded as routes are added and every file gets its own
  self-contained `beforeAll`/`afterAll` connect/close pair anyway (see
  Integration lifecycle below), so splitting has no extra setup cost.
- File suffix is always `.test.ts`.
- `describe` names the unit under test; `it` states the behavior as an
  expectation: `it('returns 404 when the prompt does not exist')`.
- Structure every test as Arrange / Act / Assert.
- No `try/catch` (or `try/finally`) blocks inside tests. Use setup and cleanup
  hooks so setup, teardown, and any database changes (seeding, cleanup) run
  regardless of the test outcome.
- For large test files, group related cases with `describe` — but nest only one
  level below the top-level `describe`.
- Database schema is managed out of testing scope. When running tests, the schema
  must have been updated outside.
- Resources (helpers, config, ...) from `lib` are restricted to `tests` scope.
  No code from `src` may use them.
- Code under `tests/lib/` is helper-only: keep it simple and do not write tests
  for it — it exists solely to support the tests.

### Where to declare test values

Placement is what keeps scoped data from leaking or being reused by mistake across
`describe` blocks:

- Mutable state set in a hook (`let` for a `db` connection, a mock, the unit
  under test) is declared with its `beforeAll`/`beforeEach`, both nested inside
  the top-level `describe` — never at file scope. See `db` in
  `DrizzlePromptCategoryRepository.test.ts`, or `repository` in the mocking
  example below.
- A unit under test that holds internal state (e.g. a client wrapping a
  connection) is constructed fresh in the setup hook, not per-test.
- Immutable values shared across the file (config objects, ids, fixtures) are
  `const`s at the top of the file.
- Sample data for one `describe`'s own tests is a `const` inside that `describe`,
  not at file scope — so it can't clash with, or be reused by mistake in, another
  block. See `prompts` in `ListPromptsUseCase.test.ts`.
- Read-only reference data reused by *several* `describe` blocks (never mutated)
  is declared once in the top-level `describe`'s setup, not per block. See
  `recipeCategory`/`travelCategory`/`fitnessCategory` in
  `DrizzlePromptRepository.test.ts`.
- A local helper used only in this file (e.g. a builder wrapping a model factory)
  goes at the top of the file, above the `describe` — never nested inside it.
  See `buildPrompt` in `ListPromptsUseCase.test.ts`:

  ```ts
  const buildPrompt = (): Prompt => {
      const { categoryId: _, ...prompt } = promptModelFactory.create();
      return { ...prompt, category: promptCategoryModelFactory.create() };
  };

  describe('ListPromptsUseCase', () => {
      const prompts = [buildPrompt(), buildPrompt()];
      // ...
  });
  ```

## Model factories

Model factories build fake-but-valid instances of a domain type, so tests don't
hand-roll object literals. They live in `tests/lib/modelFactories/`, one file
per domain type, and a singleton instance of each is exported from
`tests/lib/config.ts` for tests to import.

- **Who uses them:** any unit or integration test that needs a realistic domain
  object — use-case tests, repository tests, route tests.
- **How to create one:** extend `AbstractModelFactory<T>` and implement
  `create(data?: Partial<T>): T`, filling every field with a `@faker-js/faker`
  default, but letting `data` override individual fields:

  ```ts
  export class PromptCategoryModelFactory extends AbstractModelFactory<PromptCategory> {
      override create(data: Partial<PromptCategory> = {}): PromptCategory {
          return {
              id: data.id ?? faker.string.uuid(),
              name: data.name ?? faker.commerce.department(),
          };
      }
  }
  ```

  `AbstractModelFactory` also provides `createMany(count = 5, data?)` for free.
- **When to create a custom type instead of reusing the domain type:** when the
  shape a factory needs to build differs from the domain entity — e.g.
  `PromptModelFactory` builds `PromptModel`, which is `Prompt` with `category`
  replaced by a `categoryId`, matching the persisted/row shape rather than the
  assembled domain object. Define that type alongside the factory, not inside
  the domain layer.
- **How to use them:** import the singleton from `tests/lib/config.ts` and call
  `.create()` (optionally passing overrides) or `.createMany()`:

  ```ts
  import { promptModelFactory, promptCategoryModelFactory } from '@tests/lib/config.js';

  const prompt = promptModelFactory.create({ title: 'Fixed title' });
  ```

  When a test needs the full domain object built from a row-shaped factory,
  wrap the composition in a local builder function (see `buildPrompt` above)
  rather than repeating it inline in every test.
- After adding a new domain type, add its factory to `tests/lib/modelFactories/`
  and export a singleton instance from `tests/lib/config.ts`, following the
  existing factories.

## Mocking

- **Interfaces and classes:** mock the dependency **type** with `mock<T>()` (returns
  a `MockProxy<T>`), both from `vitest-mock-extended`. Never hand-roll fake
  implementations.
- **Functions:** use `vi.fn()` (from `vitest`).
- Build the mocks and the unit under test **fresh in `beforeEach`** so no state leaks
  between tests; set each test's return values in its own Arrange step
  (e.g. `categoryRepository.findById.mockResolvedValue(fixtureCategory)`).

```ts
import { mock, type MockProxy } from 'vitest-mock-extended';

describe('CreatePromptUseCase', () => {
    let promptRepository: MockProxy<PromptRepositoryInterface>;
    let categoryRepository: MockProxy<PromptCategoryRepositoryInterface>;
    let useCase: CreatePromptUseCase;

    beforeEach(() => {
        promptRepository = mock<PromptRepositoryInterface>();
        categoryRepository = mock<PromptCategoryRepositoryInterface>();
        useCase = new CreatePromptUseCase(promptRepository, categoryRepository);
    });
    // ...
});
```

## Errors

Use cases are async, so assert against the rejected promise with `rejects.toThrow`.
Assert both the error **type** and its **message** — one statement each:

```ts
await expect(useCase.invoke(query)).rejects.toThrow(CategoryNotFoundError);
await expect(useCase.invoke(query)).rejects.toThrow(`Category not found: ${query.categoryId}`);
```

## Test Types

### Unit (`tests/unit`)

- One piece in isolation, all its dependencies mocked.
- Mock the dependency **type**, not the real implementation. If a constructor
  takes `PromptRepositoryInterface`, mock the interface, not its implementation.
- Applies to _use cases_ in the `application` layer.

### Integration (`tests/integration`)

- Two or more real pieces working together — your code with a database, with an
  HTTP API, or two of your own modules combined.
- Applies to _adapter_ implementations in the `infrastructure` layer and _routes_
  in `app.ts`.
- When a test touches the database:
    1. Open the connection once, before all tests, in a `beforeAll` nested
       inside the top-level `describe` (not at file scope).
    2. Insert the seed data the test needs.
    3. Run the test.
    4. Clean up only the data the test inserted — leave everything else untouched.
    5. Close the connection once, after all tests, in the matching `afterAll`.
- When a repository test asserts the result of `create`/`update`/`delete`,
  verify it via a direct table query (e.g. `selectPromptsByIds` in
  `tests/lib/database/*.ts`), not by calling the repository's own read method
  (`findById`/`findAll`). This keeps a write test's correctness from
  depending on a different method under test. `findAll`/`findById` describe
  blocks are the exception — they exist specifically to test those methods,
  so asserting on their own return value there is correct.
- Same rule for handler tests: when a handler that writes (`create`/`update`/
  `delete`) needs to confirm the change actually happened, query the database
  directly with the `tests/lib/database/*.ts` helpers (e.g. `selectPromptsByIds`)
  rather than calling a different route (`GET /prompts/:id`, `GET /prompts`) to
  check. Calling another endpoint couples the write handler's test to that other
  handler's correctness and doubles up on coverage `GetPromptHandler.test.ts` /
  `GetPromptsHandler.test.ts` already provide. See
  `DeletePromptHandler.test.ts`.
- Vitest runs separate test files in parallel, so any assertion that reads
  the *entire* table (rather than filtering to the fixtures the test itself
  inserted) is racy against sibling integration test files touching the same
  table. Always filter the actual/expected data down to the test's own
  fixture ids before asserting — see `fixturesInResponse` in
  `GetPromptsHandler.test.ts` or `fixturesInResult` in
  `DrizzlePromptCategoryRepository.test.ts`.

#### Request validation

For a handler test whose route is wired with `validateRequestMiddleware` (which
responds with `400 { message, errors: {field, error}[] }` on invalid input), nest
a `describe('Request Validation', ...)` inside the handler's top-level `describe`,
containing:

- One test sending an empty payload/query, asserting an error for every
  required field.
- One additional test per other meaningful validation case (e.g. a malformed
  UUID).

Assert the `errors` array with exact object literals (`{ field, error }`),
including the literal message text — not `expect.objectContaining`, which
would let an unrelated message change pass silently. Don't re-assert the
top-level `message` string in each handler test — it's already covered once by
the middleware's own unit test (`tests/unit/middleware/validateRequest/*.test.ts`).
If a schema has no field that can actually fail validation (e.g. a route param
that's always a non-empty string), omit the `Request Validation` block
entirely rather than fabricating a failing case just to have one.

```ts
describe('Request Validation', () => {
    it('returns missing required value errors for all required fields', async () => {
        const response = await request(app).post('/prompts').send({});

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            errors: expect.arrayContaining([
                { field: 'body.title', error: 'Missing required value' },
                { field: 'body.prompt', error: 'Missing required value' },
                { field: 'body.category_id', error: 'Missing required value' },
            ]),
        });
    });

    it('returns an invalid value error for a non-uuid category_id', async () => {
        const response = await request(app).post('/prompts').send({
            title: 'title',
            prompt: 'prompt',
            category_id: '12345',
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            errors: expect.arrayContaining([{ field: 'body.category_id', error: 'Invalid UUID value' }]),
        });
    });
});
```
