---
name: testing-practices
description: Testing conventions for TypeScript apps — the TDD loop, test file structure and placement, unit vs integration tests, model factories, mocking strategy, error assertions, and the database test lifecycle. Use when writing, reviewing, or structuring any test, adding a model factory, deciding unit vs integration, or mocking a dependency.
---

# Testing Practices

All tests live under `tests/` (never inside `src/`). TDD is mandatory. The assumed
stack is Vitest as the runner, `vitest-mock-extended` for typed mocks, and
`@faker-js/faker` for fake data; add an HTTP assertion library (e.g. supertest)
when the app exposes HTTP. A project may pin or swap these — see its project docs.

## Quick rules

- Tests live under `tests/`, never in `src/`; mirror the `src/` path; suffix `.test.ts`.
- TDD every change: red → green → refactor.
- **A unit in isolation with every collaborator mocked → unit test. Two or more
  real pieces working together (your code with a DB, with an HTTP API, or two of
  your own modules) → integration test.** Which layers map to which is a
  per-project decision (see project docs).
- Mock the dependency **type** (`mock<T>()`), never a hand-rolled fake.
- Structure every test as Arrange / Act / Assert; no `try/catch` in tests — use hooks.
- Build fake domain objects with model factories, not object literals.
- Filter DB assertions to the test's own fixture ids — parallel test files share tables.
- Don't write a test for a file with no logic of its own — a composition root
  (`services.ts`), a pure re-export, an interface/type-only file. Prove it via the type
  checker and via the tests of the pieces it wires together.

## TDD loop

1. Red — smallest failing test for the next piece of behavior.
2. Green — minimum code to pass.
3. Refactor — clean up, keep the bar green.

## Structure

```
tests/
  lib/            # Shared test helpers (database, mocks, builders, sample responses,...)
    config.ts     # Test client/config + singleton model factories, imported by tests.
    modelFactories # One factory per domain type, building fake instances of it.
    database      # Helpers to insert/select/delete rows directly, one file per table (e.g. `users.ts`)
  unit/           # Unit tests
  integration/    # Integration tests
```

## Conventions

- Mirror the `src/` path under `tests/unit/` or `tests/integration/`. Example:
  `src/<path>/CreateUser.ts` -> `tests/unit/<path>/CreateUser.test.ts`.
- HTTP handler/route tests mirror their source the same way — one test file per
  handler, named after it. Don't collect multiple routes' tests into one shared
  file (e.g. a single `app.test.ts`): it grows unbounded as routes are added, and
  every file gets its own self-contained `beforeAll`/`afterAll` connect/close pair
  anyway (see Integration lifecycle below), so splitting has no extra setup cost.
- File suffix is always `.test.ts`.
- `describe` names the unit under test; `it` states the behavior as an
  expectation: `it('returns 404 when the entity does not exist')`.
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
- The same "no logic, no test" rule applies to production code: a composition root
  (a context's or `shared`'s `services.ts`, which only instantiates and exports
  singletons/use cases) gets no dedicated test file. There's no branch to cover —
  `tsc` proves the exports are shaped correctly, and the unit/integration tests of
  the pieces being wired already prove they work. This is why none of the existing
  `src/logic/{shared,user,prompt,auth}/services.ts` files have a test.

### Where to declare test values

Placement is what keeps scoped data from leaking or being reused by mistake across
`describe` blocks:

- Mutable state set in a hook (`let` for a `db` connection, a mock, the unit
  under test) is declared with its `beforeAll`/`beforeEach`, both nested inside
  the top-level `describe` — never at file scope.
- A unit under test that holds internal state (e.g. a client wrapping a
  connection) is constructed fresh in the setup hook, not per-test.
- Immutable values shared across the file (config objects, ids, fixtures) are
  `const`s at the top of the file.
- Sample data for one `describe`'s own tests is a `const` inside that `describe`,
  not at file scope — so it can't clash with, or be reused by mistake in, another
  block.
- Read-only reference data reused by *several* `describe` blocks (never mutated)
  is declared once in the top-level `describe`'s setup, not per block.
- A local helper used only in this file (e.g. a builder wrapping a model factory)
  goes at the top of the file, above the `describe` — never nested inside it:

  ```ts
  const buildOrder = (): Order => {
      const { customerId: _, ...order } = orderModelFactory.create();
      return { ...order, customer: customerModelFactory.create() };
  };

  describe('ListOrdersUseCase', () => {
      const orders = [buildOrder(), buildOrder()];
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
  export class UserModelFactory extends AbstractModelFactory<User> {
      override create(data: Partial<User> = {}): User {
          return {
              id: data.id ?? faker.string.uuid(),
              email: data.email ?? faker.internet.email(),
          };
      }
  }
  ```

  `AbstractModelFactory` also provides `createMany(count = 5, data?)` for free.
- **When to create a custom type instead of reusing the domain type:** when the
  shape a factory needs to build differs from the domain entity — e.g. a factory
  that builds the persisted/row shape (a foreign-key id in place of an assembled
  nested object) rather than the assembled domain object. Define that type
  alongside the factory, not inside the domain layer.
- **How to use them:** import the singleton from `tests/lib/config.ts` and call
  `.create()` (optionally passing overrides) or `.createMany()`:

  ```ts
  import { userModelFactory } from '@tests/lib/config.js';

  const user = userModelFactory.create({ email: 'fixed@example.com' });
  ```

  When a test needs the full domain object built from a row-shaped factory,
  wrap the composition in a local builder function (see `buildOrder` above)
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
  (e.g. `userRepository.findById.mockResolvedValue(fixtureUser)`).

```ts
import { mock, type MockProxy } from 'vitest-mock-extended';

describe('RegisterUserUseCase', () => {
    let userRepository: MockProxy<UserRepositoryInterface>;
    let passwordHasher: MockProxy<PasswordHasherInterface>;
    let useCase: RegisterUserUseCase;

    beforeEach(() => {
        userRepository = mock<UserRepositoryInterface>();
        passwordHasher = mock<PasswordHasherInterface>();
        useCase = new RegisterUserUseCase(userRepository, passwordHasher);
    });
    // ...
});
```

## Errors

Use cases are async, so assert against the rejected promise with `rejects.toThrow`.
Assert both the error **type** and its **message** — one statement each:

```ts
await expect(useCase.invoke(query)).rejects.toThrow(UserNotFoundError);
await expect(useCase.invoke(query)).rejects.toThrow(`User not found: ${query.userId}`);
```

## Test Types

### Unit (`tests/unit`)

- One piece in isolation, all its dependencies mocked.
- Mock the dependency **type**, not the real implementation. If a constructor
  takes `UserRepositoryInterface`, mock the interface, not its implementation.

### Integration (`tests/integration`)

- Two or more real pieces working together — your code with a database, with an
  HTTP API, or two of your own modules combined.
- When a test touches the database:
    1. Open the connection once, before all tests, in a `beforeAll` nested
       inside the top-level `describe` (not at file scope).
    2. Insert the seed data the test needs.
    3. Run the test.
    4. Clean up only the data the test inserted — leave everything else untouched.
    5. Close the connection once, after all tests, in the matching `afterAll`.
- When a test asserts the result of a write (`create`/`update`/`delete`), verify
  it with a direct table query (a helper in `tests/lib/database/*.ts`), **not** by
  calling the unit's own read method (`findById`/`findAll`) or another read
  endpoint. This keeps a write test's correctness from depending on a different
  method/route under test, and avoids doubling up on coverage those read tests
  already provide. `findAll`/`findById` describe blocks are the exception — they
  exist specifically to test those methods, so asserting on their own return value
  there is correct.
- Vitest runs separate test files in parallel, so any assertion that reads the
  *entire* table (rather than filtering to the fixtures the test itself inserted)
  is racy against sibling integration test files touching the same table. Always
  filter the actual/expected data down to the test's own fixture ids before
  asserting.
