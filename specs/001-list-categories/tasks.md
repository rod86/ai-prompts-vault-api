# Tasks: List categories

Plan: specs/001-list-categories/plan.md

- [x] T1. Use case returns the categories provided by the repository
    - Red: `tests/unit/logic/prompt/application/ListPromptCategoriesUseCase.test.ts` —
      construct `ListPromptCategoriesUseCase` with a `mock<PromptCategoryRepositoryInterface>()`
      (per `docs/testing.md`); set `repository.findAll.mockResolvedValue([...])`
      with two fixture categories (id/name via faker); call `useCase.invoke()`;
      assert the result equals the two fixture categories exactly. Fails: the
      domain entity, port interface, and use case class do not exist yet.
    - Green: create `src/logic/prompt/domain/PromptCategory.ts`,
      `src/logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.ts`,
      and `src/logic/prompt/application/ListPromptCategoriesUseCase.ts` whose
      `invoke()` returns `this.repository.findAll()`.
    - Covers: AC1 "Given multiple categories exist, When the user requests the
      list of categories, Then the response includes every category, each with
      its id and name."

- [x] T2. Use case returns an empty array when the repository has none
    - Red: same file — new `it`; `repository.findAll.mockResolvedValue([])`;
      assert `useCase.invoke()` resolves to `[]`.
    - Green: no production change expected if T1's `invoke()` simply returns
      the repository's result; run the test to confirm the empty case already
      passes without special-casing.
    - Covers: AC3 "Given no categories exist, When the user requests the list
      of categories, Then the response is an empty list, not an error."

- [x] T3. Categories are stored and listed ordered alphabetically by name
    - Red: `tests/integration/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.test.ts` —
      per `docs/testing.md` integration conventions, open the DB connection
      once in `beforeAll`; insert fixture rows with names deliberately out of
      alphabetical order (e.g. "Writing & Content", "Business & Finance",
      "Coding & Development"), each with an explicit application-generated `id`
      (per `docs/database.md`), via a `tests/lib/seeding` helper; call
      `new DrizzlePromptCategoryRepository(db).findAll()`; assert the returned
      array contains the inserted categories sorted alphabetically by name,
      ascending, each with correct `id`/`name`; delete only the inserted rows
      in `afterEach`; close the connection in `afterAll`. Fails: the
      `prompt_categories` table, schema, and repository class do not exist yet.
    - Green: define the `prompt_categories` table in
      `src/logic/prompt/infrastructure/database/schema.ts` (`id` uuid primary
      key with no default — value always supplied by the caller on insert per
      `docs/database.md`; `name` text not null); register the schema in
      `src/config.ts`'s `database.schema` aggregation and pass it into
      `DatabaseClient` in `src/logic/shared/services.ts` (replacing `{}`);
      generate and apply the table-creation migration (`npx drizzle-kit
generate`, `npx drizzle-kit migrate`); add a hand-authored seed migration
      inserting the eleven initial categories listed in spec §1 "Initial data"
      (also in plan.md §7), each with its fixed literal `id` UUID from plan.md
      §7 step 2; implement `DrizzlePromptCategoryRepository.findAll()` ordering
      by `lower(name)` then `id`.
    - Covers: AC1 (see T1 text above); AC2 "Given multiple categories exist,
      When the user requests the list of categories, Then the categories are
      ordered alphabetically by name, ascending."

- [x] T4. Repository returns an empty array when the categories table has no rows
    - Red: same file as T3 — new `it`; capture the table's current rows
      (including the seeded starter set), delete all rows, call `findAll()`,
      assert it resolves to `[]`, then re-insert the exact captured rows in a
      `finally` block (per plan.md §9 Risk 1) so no data is permanently lost.
    - Green: no production change expected; the existing `findAll()`
      implementation already returns `[]` for an empty table. Run the test to
      confirm.
    - Covers: AC3 (see T2 text above).

- [x] T5. `GET /categories` returns all categories ordered alphabetically by name
    - Red: `tests/integration/app.test.ts` — using `supertest` against the
      real Express `app`, seed additional fixture categories via the
      `tests/lib/seeding` helper (names chosen to be out of alphabetical
      order); `GET /categories`; assert status `200` and that the JSON body is
      an array containing every expected category (seeded starter set +
      fixtures), each with `id` and `name`, sorted alphabetically by name,
      ascending; clean up only the inserted fixture rows afterward. Fails: no
      route, handler, or service wiring exists yet.
    - Green: create `src/handlers/GetCategories.ts` (default export) that
      calls the prompt context's `listPromptCategoriesUseCase.invoke()` and
      responds `200` with the JSON array; create
      `src/logic/prompt/services.ts` wiring
      `DrizzlePromptCategoryRepository` (via `databaseClient.connect()` from
      `@logic/shared/services`) into `listPromptCategoriesUseCase`; register
      `app.get('/categories', getCategoriesHandler)` in `src/app.ts`.
    - Covers: AC1, AC2 (see texts above).

- [x] T6. `GET /categories` returns an empty list when there are no categories
    - Red: same file as T5 — new `it`; capture and delete all rows from
      `prompt_categories` via the seeding helper, `GET /categories`, assert
      status `200` and body equals `[]`, then restore the exact captured rows
      in a `finally` block (mirrors T4's approach at the route level).
    - Green: no production change expected; confirm the endpoint already
      responds `200` with `[]` rather than an error.
    - Covers: AC3 (see text above).

## Coverage check

| AC# | Criterion text (verbatim from spec §5)                                                                                                                | Covered by task(s) |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1 | Given multiple categories exist, When the user requests the list of categories, Then the response includes every category, each with its id and name. | T1, T3, T5         |
| AC2 | Given multiple categories exist, When the user requests the list of categories, Then the categories are ordered alphabetically by name, ascending.    | T3, T5             |
| AC3 | Given no categories exist, When the user requests the list of categories, Then the response is an empty list, not an error.                           | T2, T4, T6         |
