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

- Unit tests are the bulk: fast, deterministic, no network/DB.
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

```ts
describe('CreatePrompt', () => {
  it('stores a new prompt and returns its id', async () => {
    // Arrange
    const repo = new InMemoryPromptRepository();
    const createPrompt = new CreatePrompt(repo);

    // Act
    const id = await createPrompt.execute({ title: 'Greet', content: 'Hi {name}' });

    // Assert
    expect(await repo.findById(id)).not.toBeNull();
  });
});
```

## TDD loop

1. Red — smallest failing test for the next item in `tasks.md`.
2. Green — minimum code to pass.
3. Refactor — clean up against `coding-style.md`, keep the bar green.

## Test doubles

In-memory port implementations are the standard double — prefer these
real-but-fast impls over ad-hoc mocks. Reset/reconstruct between tests so state
never leaks.

## Tooling

- Runner: Vitest (`vitest.config.ts`), path aliases via `vite-tsconfig-paths`.
- HTTP assertions: Supertest.
- Run the suite: `npm test` (`vitest run`, single pass — the CI command).
