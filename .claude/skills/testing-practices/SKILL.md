---
name: testing-practices
description: Testing conventions for TypeScript apps — the TDD loop, test file structure and placement, unit vs integration tests, model factories, database fixtures across related tables, mocking strategy, error assertions, and the database test lifecycle. Use when writing, reviewing, or structuring any test, adding a model factory, setting up or cleaning up fixtures across foreign-key tables, deciding unit vs integration, or mocking a dependency.
---

# Testing Practices

All tests live under `tests/` (never inside `src/`). TDD is mandatory. The assumed
stack is Vitest as the runner, `vitest-mock-extended` for typed mocks, and
`@faker-js/faker` for fake data; add an HTTP assertion library (e.g. supertest)
when the app exposes HTTP. A project may pin or swap these — see its project docs.

## Quick rules

- **Keep tests simple.** Passing is the floor, not the goal: a test must also be
  easy to read, understand, and maintain. Prefer the plain, obvious version over
  clever, compact, or over-abstracted code. If a test takes real effort to follow,
  simplify it (see [Keep tests simple](#keep-tests-simple)).
- Tests live under `tests/`, never in `src/`; mirror the `src/` path; suffix `.test.ts`.
- TDD every change: red → green → refactor.
- **A unit in isolation with every collaborator mocked → unit test. Two or more
  real pieces working together (your code with a DB, with an HTTP API, or two of
  your own modules) → integration test.** Which layers map to which is a
  per-project decision (see project docs).
- Mock the dependency **type** (`mock<T>()`), never a hand-rolled fake.
- Structure every test as Arrange / Act / Assert; no `try/catch` in tests — use hooks.
- Build fake domain objects with model factories, not object literals.
- Persist and clean up DB rows through the per-table **fixture classes**
  (`tests/lib/fixtures/`, instantiated via `create<Entity>Fixture()` from
  `tests/lib/config.ts`) — never a raw insert/delete inline.
- Never write a raw ORM/db-library query inline in a test (`db.select()/.insert()/.update()/.delete()`,
  raw SQL, etc.). Writes/deletes go through a fixture; read-backs go through a
  helper in `tests/lib/database/<entity>.ts`.
- Before writing new setup/fixture/assertion logic, check `tests/lib/` (model factories,
  fixtures, database read-back helpers, other shared helpers) for something that already
  does it — reuse or extend it rather than duplicating inline.
- Filter DB assertions to the test's own fixture ids — parallel test files share tables.
- Don't write a test for a file with no logic of its own — a composition root
  (`services.ts`), a pure re-export, an interface/type-only file. Prove it via the type
  checker and via the tests of the pieces it wires together.

## Keep tests simple

A test has two jobs: pass, **and** stay easy to read and maintain. The second is not
optional. A test is documentation of behavior that another person (or you, later) has to
trust at a glance — so favor the plain and obvious over the clever and compact.

- Prefer straightforward, linear tests: a clear Arrange / Act / Assert with no hidden
  control flow. Avoid loops, conditionals, and branching in a test body — if you're
  tempted, write separate `it`s or a table of cases instead.
- Don't over-abstract. Reach for shared helpers (model factories, fixtures, `tests/lib`)
  to remove real duplication and keep tests in domain terms — not to compress a test into
  something you have to decode. A little repetition is fine when it makes the test read
  top-to-bottom.
- Keep each test focused on one behavior, with only the setup that behavior needs
  visible. Push incidental wiring into hooks/helpers; keep what the test is actually
  proving in the test.
- When a test is genuinely hard to follow, that is a signal to simplify it (or the code
  under test) — not to add a comment explaining the complexity.

This applies to the refactor step below: refactor the **tests** for clarity too, not just
the production code.

## TDD loop

1. Red — smallest failing test for the next piece of behavior.
2. Green — minimum code to pass.
3. Refactor — clean up, keep the bar green.

## Structure

```
tests/
  lib/            # Shared test helpers (fixtures, factories, database, mocks, builders,...)
    config.ts     # Shared DB client + singleton model factories + create<Entity>Fixture() helpers.
    modelFactories # One factory per domain type, building fake instances of it.
    fixtures      # One fixture class per table: persists a factory object + tracks/cleans its ids.
    database      # Read-back helpers only (select rows to verify a write), one file per table.
  unit/           # Unit tests
  integration/    # Integration tests
```

## Conventions

- Mirror the `src/` path under `tests/unit/` or `tests/integration/`. Example:
  `src/<path>/CreateUser.ts` -> `tests/unit/<path>/CreateUser.test.ts`.
- HTTP handler/route tests mirror their source the same way — one test file per
  handler, named after it. Don't collect several routes' tests into one shared file:
  it grows unbounded as routes are added, so a per-handler split keeps each file
  focused (setup cost is the same either way — see Integration lifecycle below).
- `app.test.ts` is the exception, and it is **not** a route dumping ground: it tests
  `app.ts`-level concerns — the application-wide wiring that isn't owned by any single
  handler (the 404 / not-found contract, the centralized error middleware, generic
  middleware, the health check). Per-route behavior still belongs in that route's own
  file.
- File suffix is always `.test.ts`.
- `describe` names the unit under test; `it` states the behavior as a plain-language
  expectation, not a technical restatement of the implementation:
  `it('returns 404 when the entity does not exist')`. Keep titles simple and as
  non-technical as possible — describe what the test proves, from the caller's
  point of view, not how the code achieves it. Never embed a reference code from a
  user story or task list (`AC3`, `T7`, `E1`, a ticket id, …): it's meaningless
  without that document open and goes stale the moment specs are renumbered. If
  you're tempted to cite one, spell out in plain words what it stood for instead.

  ```ts
  // Avoid — cites a spec/task code instead of saying what's verified
  it('rejects with the E1 envelope', async () => { ... });

  // Prefer — plain language, reveals intent
  it('rejects a request once the allowance is exhausted with the standard error envelope', async () => { ... });
  ```
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
- The same "no logic, no test" rule applies to production code: a bounded context's
  composition root (its `services.ts`, which only instantiates and exports
  singletons/use cases) gets no dedicated test file, regardless of what the
  business-logic directory is named in this project (see project docs). There's no
  branch to cover — `tsc` proves the exports are shaped correctly, and the
  unit/integration tests of the pieces being wired already prove they work.

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

## Fixtures

A **fixture** persists a model-factory object to the database for an integration test
and owns its cleanup. Fixtures are **classes**, one per table, in `tests/lib/fixtures/`
(extending `AbstractFixture<T>`). A fixture wraps the shared `databaseClient` plus that
table's model factory, so tests never hand-roll a row, write raw SQL/ORM queries, or
truncate a table.

### The fixture class

`AbstractFixture<TModel>` gives every fixture an internal `Set` of the ids it created
and three operations; each subclass implements `insert`/`cleanup` for its table:

- `insert(data?)` — builds a row via the model factory (with optional overrides),
  persists it (mapping domain fields to columns, e.g. `categoryId` → `promptCategoryId`),
  tracks its id, and returns the model.
- `cleanup()` — deletes every id the fixture tracked (`where(inArray(id, [...ids]))`),
  then clears the set; no-ops when nothing was inserted.
- `register(id)` — tracks an id the fixture did **not** insert itself, so `cleanup()`
  still removes it. Use it when the code under test performs the insert — e.g. after
  `repository.create(row)` or a `POST` that creates a row, call
  `fixture.register(row.id)` so teardown covers it.

Instantiate one fixture per table via the `create<Entity>Fixture()` helper from
`tests/lib/config.ts`, as a `const` inside the top-level `describe`:

```ts
const categoryFixture = createPromptCategoryFixture();
const userFixture = createUserFixture();
const promptFixture = createPromptFixture();
```

### Insert in the same test; clean up via the fixture

Insert the entity-under-test **inside the `it` that uses it**, and let the fixture's
`cleanup()` (called from an `afterEach`) remove only the ids it tracked — never a shared
manual delete, never a truncate. Sibling integration files run in parallel against the
same tables (see the Integration lifecycle below).

```ts
afterEach(async () => {
    await promptFixture.cleanup(); // deletes only this suite's prompt rows
});

it('updates and returns the prompt', async () => {
    const existingPrompt = await promptFixture.insert({ categoryId: fixtureCategory.id });

    // ...act + assert...
});
```

When the code under test does the insert, register the id so cleanup still covers it:

```ts
await repository.create(row);
promptFixture.register(row.id);
```

### Read-back helpers (`tests/lib/database/<entity>.ts`)

Writes and deletes go through the fixture; **reading rows back to assert on a write** goes
through a per-table helper. One file per table (e.g. `tests/lib/database/prompts.ts`),
each taking the `db` connection first and early-returning on an empty array:

- `select<Entities>ByIds(db, ids)` — reads rows back to verify a write landed (or that a
  related row was left unchanged).
- `select<Entities>By<Column>(db, value)` — a lookup by some other column when a test
  needs one.

**No raw queries inline in a test.** If a test needs a read no existing helper covers, add
a function to that table's file (named after what it filters by) rather than calling
`db.select()` directly — and check the file first for one that already fits.

### Related tables (foreign keys)

When the entity under test references a parent row, split the two fixtures by lifetime and
respect the FK ordering:

- **Shared parent / reference rows** (the FK target, read-only across the file's tests):
  insert them once in `beforeAll`; clean them in `afterAll`.
- **Per-test child rows** (the entity under test): insert inside each `it`; clean them in
  `afterEach`.
- **Order:** insert parent-before-child; clean child-before-parent — matching the FK
  constraint.

```ts
beforeAll(async () => {
    db = databaseClient.getConnection();
    fixtureCategory = await categoryFixture.insert({ name: '...' }); // parent first
    creatorUser = await userFixture.insert();
});

afterEach(async () => {
    await promptFixture.cleanup(); // child rows, after each test
});

afterAll(async () => {
    await categoryFixture.cleanup(); // parents last
    await userFixture.cleanup();
});
```

Name the fixture instance `<entity>Fixture` (`promptFixture`); name the models it returns
after their role in the test (`existingPrompt`, `creatorUser`, `fixtureCategory`).
Connection open/close is not per-file boilerplate here — a shared setup file opens the
`databaseClient` once per integration file (see Integration lifecycle below).

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
    1. Open the connection once per integration file — in a shared setup hook the
       runner applies to every integration file, or a `beforeAll` nested inside the
       top-level `describe` (never at file scope).
    2. Insert the seed data the test needs through a fixture (`fixture.insert(...)`),
       parents in `beforeAll`, per-test rows in the `it`.
    3. Run the test.
    4. Clean up only the data the test inserted, via the fixture's `cleanup()`
       (children in `afterEach`, parents in `afterAll`) — leave everything else
       untouched, never truncate.
    5. Close the connection once, after all tests, in the matching `afterAll` (or the
       shared teardown hook).
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


## Coverage

If coverage reporting is enabled, prefer emitting these formats — each serves a different reader:

| Format       | Who uses it | Description                                    |
|--------------|-------------|--------------------------------------------------|
| text         | User        | Per-file summary printed to the terminal          |
| html         | User        | Browsable, line-by-line coverage report           |
| json-summary | AI          | Quick per-file totals — fast to check for gaps     |
| lcov         | AI          | Line/branch-level detail — pinpoints uncovered lines |

Treat any configured threshold as a floor, not a target: don't chase 100%, and don't add tests
to a file with no logic of its own (composition roots, re-exports, type-only files) just to pad
the number.

