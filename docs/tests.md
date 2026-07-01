# Tests

All tests live under `tests/` (never inside `src/`). TDD is mandatory.

## Structure

```
tests/
  lib/            # Shared test helpers (fixtures, mocks, builders)
  unit/           # Domain + application (use cases), in-memory adapters, no I/O
  integration/    # HTTP end-to-end via Supertest against the Express app
```

- Mirror the `src/` path under `tests/unit/`. Example:
  `src/logic/prompt/application/CreatePrompt.ts`
  -> `tests/unit/logic/prompt/application/CreatePrompt.test.ts`.
- File suffix is always `.test.ts`.

## Test types

| Type        | Covers                       | Dependencies                      |
| ----------- | ---------------------------- | --------------------------------- |
| Unit        | Domain + use cases           | In-memory port impls, no I/O      |
| Integration | HTTP behavior end-to-end     | Supertest against `src/app.ts`    |

- Unit tests are the bulk: fast, deterministic, no network/DB. Mock external ports.
- Integration tests import the app from `src/app.ts` and assert real HTTP
  status codes and bodies.
- DB-backed integration is deferred until PostgreSQL + Prisma land; a test-DB
  strategy will be added here then.

## Conventions

- `describe` names the unit under test; `it` states the behavior as an
  expectation: `it('returns 404 when the prompt does not exist')`.
- Structure every test as Arrange / Act / Assert.
- One behavior per test. No shared mutable state — build fresh fixtures per test
  (or in `beforeEach`). Test public surfaces, not internals.
- Hardcoded values shared across tests (config objects, ids, fixtures) go in
  `const` declarations at the top of the file, not inline in each test.
- When a unit under test holds internal state (e.g. a client wrapping a
  connection), construct a fresh instance of it in `beforeEach` rather than
  per-test, so setup isn't duplicated across cases.

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

## Mocking

- **Interfaces and classes:** use `vitest-mock-extended`, e.g.
  `mock<PromptRepositoryInterface>()` or `mock<Pool>()`. Never hand-roll fake
  implementations. Type the held reference as `MockProxy<T>`.
- **Functions:** use native Vitest, e.g. `vi.fn()`.
- Construct the mock(s) and the unit under test in `beforeEach`; set each test's
  return values in its own Arrange step with `.mockResolvedValue(...)`.

```ts
describe('ListCategoriesUseCase', () => {
  let repository: MockProxy<PromptCategoryRepositoryInterface>;
  let useCase: ListCategoriesUseCase;

  beforeEach(() => {
    repository = mock<PromptCategoryRepositoryInterface>();
    useCase = new ListCategoriesUseCase(repository);
  });

  it('returns an empty list without error when no categories exist', async () => {
    // Arrange
    repository.findAll.mockResolvedValue([]);

    // Act
    const response = await useCase.invoke();

    // Assert
    expect(response).toEqual({ categories: [] });
  });
});
```

### Errors

Assert both the error type and message:

```ts
expect(() => useCase.execute(input)).toThrow(CreatePromptError);
expect(() => useCase.execute(input)).toThrow("Error creating the prompt");
```


## TDD loop

1. Red — smallest failing test for the next item in `tasks.md`.
2. Green — minimum code to pass.
3. Refactor — clean up against `coding-style.md`, keep the bar green.


## Tooling

- Runner: Vitest (`vitest.config.ts`), path aliases via `vite-tsconfig-paths`.
- HTTP assertions: Supertest.
- Run the suite: `npm test` (`vitest run`, single pass — the CI command).
