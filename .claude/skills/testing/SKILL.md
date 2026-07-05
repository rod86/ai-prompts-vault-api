---
name: testing
description: Library-agnostic testing strategy — the TDD loop, unit vs integration boundaries, Arrange/Act/Assert, mirror-src layout, mock-by-interface, and the database-integration lifecycle. Use when writing tests or structuring tasks around TDD. Concrete runner/mocking examples live in the project-stack skill.
---

# Testing

All tests live under `tests/` (never inside `src/`). TDD is mandatory. Concrete
runner, mocking library, and code examples are in the `project-stack` skill.

## TDD loop

1. Red — smallest failing test for the next item in `tasks.md`.
2. Green — minimum code to pass.
3. Refactor — clean up against the `coding-style` skill, keep the bar green.

## Structure

```
tests/
  lib/            # Shared test helpers (seeding, mocks, builders, sample responses,...)
    config.ts     # Test databaseClient + TestDatabaseConnection type, and singleton model factories, imported by tests.
    modelFactories # One factory per domain type, building fake instances of it.
    seeding       # Helpers to seed database, one file per table schema (e.g. `prompts.ts`)
  unit/           # Unit tests
  integration/    # Integration tests
```

## Conventions

- Mirror the `src/` path under `tests/unit/` or `tests/integration`. Example:
  `src/logic/prompt/application/CreatePrompt.ts` ->
  `tests/unit/logic/prompt/application/CreatePrompt.test.ts`.
- File suffix is always `.test.ts`.
- `describe` names the unit under test; `it` states the behavior as an
  expectation: `it('returns 404 when the prompt does not exist')`.
- Structure every test as Arrange / Act / Assert.
- No `try/catch` (or `try/finally`) blocks inside tests. Use setup and cleanup
  hooks so setup, teardown, and any database changes (seeding, cleanup) run
  regardless of the test outcome.
- For large test files, group related cases with `describe` — but nest only one
  level below the top-level `describe`.
- When a unit under test holds internal state (e.g. a client wrapping a
  connection), construct a fresh instance in the setup hook rather than per-test,
  so setup isn't duplicated across cases.
- Hardcoded values shared across tests (config objects, ids, fixtures) go in
  `const` declarations at the top of the file, not inline in each test.
- Sample data built for a `describe` block's own tests is declared as a `const`
  inside that `describe`, not at the top of the file — this keeps it scoped so
  it can't clash with, or be reused by mistake in, another `describe` in the
  same file later. See `prompts` inside `ListPromptsUseCase.test.ts`'s
  `describe`.
- Local helper functions used only within one test file (e.g. a builder wrapping
  a model factory) go at the top of the file, above the `describe` block — never
  nested inside it. See `buildPrompt` in
  `tests/unit/logic/prompt/application/ListPromptsUseCase.test.ts`:

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
- Database schema is managed out of testing scope. When running tests, the schema
  must have been updated outside.
- Resources (helpers, config, ...) from `lib` are restricted to `tests` scope.
  No code from `src` may use them.
- Code under `tests/lib/` is helper-only: keep it simple and do not write tests
  for it — it exists solely to support the tests.

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

- **Interfaces and classes:** mock the dependency **type**, never hand-roll fake
  implementations.
- **Functions:** use the runner's function-mock primitive.
- Construct the mock(s) and the unit under test in the setup hook; set each
  test's return values in its own Arrange step.
- Reset mocks between tests so one test's state never leaks into the next.

## Errors

Assert both the error **type** and **message**:

```ts
expect(() => useCase.execute(input)).toThrow(CreatePromptError);
expect(() => useCase.execute(input)).toThrow('Error creating the prompt');
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
    1. Open the connection once, before all tests.
    2. Insert the seed data the test needs.
    3. Run the test.
    4. Clean up only the data the test inserted — leave everything else untouched.
    5. Close the connection once, after all tests.

Concrete runner/mocking/HTTP-assertion examples: see the `project-stack` skill.
