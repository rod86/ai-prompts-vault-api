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
    config.ts     # Override config from `src`.
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
- Database schema is managed out of testing scope. When running tests, the schema
  must have been updated outside.
- Resources (helpers, config, ...) from `lib` are restricted to `tests` scope.
  No code from `src` may use them.
- Code under `tests/lib/` is helper-only: keep it simple and do not write tests
  for it — it exists solely to support the tests.

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
