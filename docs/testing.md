# Testing

All tests live under `tests/` (never inside `src/`). TDD is mandatory.

## Tooling

- Runner: Vitest (`vitest.config.ts`), path aliases via `vite-tsconfig-paths`.
- Mocking library: `vitest-mock-extended`.
- HTTP assertions: `supertest`.
- Run the suite: `npm test` (`vitest run`, single pass — the CI command).

## TDD loop

1. Red — smallest failing test for the next item in `tasks.md`.
2. Green — minimum code to pass.
3. Refactor — clean up against `coding-style.md`, keep the bar green.

## Structure

```
tests/
  lib/            # Shared test helpers (seeding, mocks, builders, sample API responses,...)
    config.ts     # Override config from `src`.
    seeding       # Helpers to seed database
  unit/           # Unit tests
  integration/    # Integration tests
```

## Conventions

- Mirror the `src/` path under `tests/unit/` or `tests/integration`. Example:
  `src/logic/prompt/application/CreatePrompt.ts` -> `tests/unit/logic/prompt/application/CreatePrompt.test.ts`.
- File suffix is always `.test.ts`.
- `describe` names the unit under test; `it` states the behavior as an
    expectation: `it('returns 404 when the prompt does not exist')`.
- Structure every test as Arrange / Act / Assert.
- No `try/catch` (or `try/finally`) blocks inside tests. Use Vitest hooks
    (`beforeAll`/`beforeEach` for setup, `afterEach`/`afterAll` for cleanup) so
    teardown runs regardless of the test outcome.
- For large test files, group related cases with describe — but nest only one level below the top-level describe.
- When a unit under test holds internal state (e.g. a client wrapping a
  connection), construct a fresh instance of it in `beforeEach` rather than
  per-test, so setup isn't duplicated across cases.
- Hardcoded values shared across tests (config objects, ids, fixtures) go in
    `const` declarations at the top of the file, not inline in each test.
- Database schema is managed out of testing scope. when running them, database schema must have been updated outside.
- Use `faker-js/faker` to generate sample data like input data and mocked returned data
- Resources (helpers, config, ...) from `lib` directory is restricted to `tests` scope. Any code from `src` should not use it.
- Code under `tests/lib/` is helper-only: keep it simple and do not write tests
    for it — it exists solely to support the tests.

## Mocking

- **Interfaces and classes:** use `vitest-mock-extended`, e.g.
  `mock<PromptRepositoryInterface>()` or `mock<Pool>()`. Never hand-roll fake
  implementations. Type the held reference as `MockProxy<T>`.
- **Functions:** use native Vitest, e.g. `vi.fn()`.
- Construct the mock(s) and the unit under test in `beforeEach`; set each test's
  return values in its own Arrange step with `.mockResolvedValue(...)`.
- Reset mocks in beforeEach so one test's state never leaks into the next (if needed).

**Example**
```ts
describe('CreatePromptUseCase', () => {
  let repository: MockProxy<PromptRepositoryInterface>;
  let useCase: CreatePromptUseCase;

  beforeEach(() => {
    repository = mock<PromptRepositoryInterface>();
    useCase = new CreatePromptUseCase(repository);
  });

  it('stores a new prompt and returns its id', async () => {
    // Arrange
    repository.create.mockResolvedValue(undefined);

    // Act
    const { id } = await useCase.invoke({ title: 'Greet', prompt: 'Hi {name}' });

    // Assert
    expect(repository.create).toHaveBeenCalledOnce();
    expect(id).toBeDefined();
  });
});
```

## Errors

Assert both the error type and message:

```ts
expect(() => useCase.execute(input)).toThrow(CreatePromptError);
expect(() => useCase.execute(input)).toThrow("Error creating the prompt");
```

## Test Types

### Unit (`tests/unit')

- one piece in isolation, all its dependencies mocked
- Mock the dependency type, not real implementation. For example: If the constructor has type `PromptRepositoryInterface`, mock the interface, not its implementation.
- Applies to *use cases* in `application` layer.

### Integration (`tests/integration`)

- Two or more real pieces working together — your code with a database, with an HTTP API, or two of your own modules combined.
- Applies to *adapter* implementations in the `infrastructure` layer and *routes* in `app.ts`.
- When a test touches the database:
    1. Open the connection once, before all tests (`beforeAll`).
    2. Insert the seed data the test needs.
    3. Run the test.
    4. Clean up only the data the test inserted — leave everything else untouched.
    5. Close the connection once, after all tests (`afterAll`).
