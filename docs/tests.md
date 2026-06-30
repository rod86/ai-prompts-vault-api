# Tests

How testing is organized. This is the authoritative testing guide referenced by
the [constitution](../specs/memory/constitution.md §6). TDD is mandatory — see
[`spec-driven.md`](./spec-driven.md) for how tests drive implementation.

---

## Test types

| Type            | Tests                                   | Dependencies                          |
| --------------- | --------------------------------------- | ------------------------------------- |
| **Unit**        | Domain + application (use cases)        | In-memory adapters, no I/O            |
| **Integration** | HTTP behavior end-to-end                | Supertest against the Express `app`   |

- **Unit tests** are the bulk. They run the domain and use cases against
  in-memory port implementations — fast, deterministic, no network or DB.
- **Integration tests** import the app from [`src/app.ts`](../src/app.ts) and
  drive it with Supertest, asserting on real HTTP status codes and bodies.
- **DB-backed integration is deferred** until PostgreSQL + Prisma are introduced.
  When that lands, add a test-DB strategy section here.

---

## Location & naming

- **Unit tests** live next to the code they cover, inside the bounded context:
  `src/logic/<context>/.../CreatePrompt.test.ts`.
- **Integration tests** live under `tests/integration/`.
- File suffix is `.test.ts` (or `.spec.ts`).
- Describe the unit under test in `describe`, and the behavior in `it`, phrased as
  an expectation: `it('returns 404 when the prompt does not exist')`.
- Structure every test as **Arrange / Act / Assert**.

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

---

## The TDD loop

Tests come first, always:

1. **Red** — write the smallest failing test for the next item in `tasks.md`.
2. **Green** — write the minimum code to make it pass.
3. **Refactor** — clean up against [`coding-style.md`](./coding-style.md) while
   keeping the bar green.

Guidelines:

- One behavior per test. A test that asserts five unrelated things hides which
  one broke.
- No shared mutable state between tests — build fresh fixtures in each test (or
  in `beforeEach`).
- Test behavior through public surfaces, not private internals.

---

## Fixtures & test doubles

- **In-memory repositories are the standard test double.** Each bounded context
  ships an in-memory implementation of its port; unit tests use it directly.
  Prefer these real-but-fast implementations over ad-hoc mocks.
- Reset (or reconstruct) doubles between tests so state never leaks.
- A DB test strategy (transactional rollback or schema-per-run) will be added
  here when the Prisma adapter is introduced.

---

## Tooling & commands

- Runner: **Vitest** (config in [`vitest.config.ts`](../vitest.config.ts)), with
  path-alias support via `vite-tsconfig-paths`.
- HTTP assertions: **Supertest**.
- Run the suite with:

  ```bash
  npm test
  ```

  (`vitest run` — single pass, the same command CI will use once it exists.)
