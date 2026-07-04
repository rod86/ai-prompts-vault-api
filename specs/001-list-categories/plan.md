# Plan: List categories
Spec: specs/001-list-categories/spec.md
Status: READY FOR REVIEW

## 1. Bounded context

Owning context: **prompt** (`src/logic/prompt/`).

Per the Decisions log (spec §6, #1), categories are modeled as `PromptCategory`
within the `prompt` bounded context rather than as a standalone context, matching
the illustrative `PromptCategory` / `PromptCategoryRepositoryInterface` naming
already used as the canonical example in `docs/architecture.md`. This is the
first feature built in this repository, so this decision also establishes the
`prompt` context's initial folder structure (`domain/`, `application/`,
`infrastructure/`, `services.ts`) per `docs/architecture.md`.

No cross-context interactions: this feature only reads categories, and no
other bounded context exists yet.

## 2. Entities and value objects

**`PromptCategory`** (new) — `src/logic/prompt/domain/PromptCategory.ts`

| Field | Type | From spec | Invariants |
|---|---|---|---|
| id | `string` | spec §2 `id` | none enforced by this read-only feature (spec §3) |
| name | `string` | spec §2 `name` | none enforced by this read-only feature (spec §3) |

```ts
export interface PromptCategory {
  id: string;
  name: string;
}
```

## 3. Ports

**`PromptCategoryRepositoryInterface`** (new) —
`src/logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.ts`

```ts
import { PromptCategory } from '@logic/prompt/domain/PromptCategory';

export default interface PromptCategoryRepositoryInterface {
  findAll(): Promise<PromptCategory[]>;
}
```

- `findAll()` returns every category, already ordered alphabetically by name
  ascending (spec AC2). Ordering is guaranteed by the adapter's query (§7), not
  recomputed by the use case, so the port's contract documents the guarantee.
- New port: no repository for categories exists yet (first feature in this
  context).

## 4. Use cases

**`ListPromptCategoriesUseCase`** (new) —
`src/logic/prompt/application/ListPromptCategoriesUseCase.ts`

- Input: none (no `Query` — the operation takes no parameters).
- Output: `PromptCategoryResponse[]`.
- Ports called: `PromptCategoryRepositoryInterface.findAll()`.
- AC satisfied: AC1, AC2 (pass-through of the adapter's ordered result), AC3.

```ts
export interface PromptCategoryResponse {
  id: string;
  name: string;
}

export class ListPromptCategoriesUseCase {
  constructor(private readonly repository: PromptCategoryRepositoryInterface) {}

  public async invoke(): Promise<PromptCategoryResponse[]> {
    return this.repository.findAll();
  }
}
```

## 5. Routes

**`GET /categories`**

- Request: no path/query params, no body.
- Response `200`: JSON array of `{ id: string, name: string }`, ordered
  alphabetically by name ascending; `[]` when no categories exist (AC3).
- Spec §4 defines no error responses (E#) for this operation, so there is
  nothing to map to a non-200 status code. Handler: `src/handlers/GetCategories.ts`
  (default export, per `docs/architecture.md` handler convention), reaching
  business logic only via `src/logic/prompt/services.ts`.

## 6. Zod schemas

None required. Per `docs/coding-style.md`, Zod validates external input at
the HTTP boundary; this endpoint accepts no body, query, or path parameters,
so there is no input to validate. No V# exist in spec §3 to trace.

## 7. Persistence adapter

**Schema** (new) — `src/logic/prompt/infrastructure/database/schema.ts`

```ts
export const promptCategories = pgTable('prompt_categories', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
});
```

- Table: `prompt_categories`, per `docs/database.md`'s "Owned entities" naming
  convention, which gives `prompt_categories` as the worked example for the
  *PromptCategory* entity (owned by the `prompt` context, per Decision #1).
- `id` is a `uuid` primary key with **no** `.defaultRandom()` default: per
  `docs/database.md`'s Column conventions, every `id` value is always provided
  by the caller/application on insert, never database-generated. `name` is
  required text. No uniqueness constraint is required by this read-only
  feature (spec §3 has no validation rules); adding one is deferred to the
  future category-creation feature that will define that invariant.

**Repository adapter** (new) —
`src/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts`
implements `PromptCategoryRepositoryInterface`:

```ts
public async findAll(): Promise<PromptCategory[]> {
  return this.db
    .select({ id: promptCategories.id, name: promptCategories.name })
    .from(promptCategories)
    .orderBy(sql`lower(${promptCategories.name})`, promptCategories.id);
}
```

- Ordering is case-insensitive alphabetical by name (`lower(name)`), with
  `id` as a secondary sort key so the result order is stable/deterministic
  when two categories share the same name (spec AC2; see §9 Assumption 3).
- Domain↔storage mapping is direct: `prompt_categories.id` → `PromptCategory.id`,
  `prompt_categories.name` → `PromptCategory.name`.

**Wiring:**
- `src/config.ts`: aggregate the new schema, e.g.
  `import * as promptSchema from '@logic/prompt/infrastructure/database/schema.js';`
  and add it to `database.schema` (currently `{}` in
  `src/logic/shared/services.ts`), per `docs/database.md`.
- `src/logic/shared/services.ts`: pass the aggregated schema into
  `DatabaseClient` instead of `{}`.
- `src/logic/prompt/services.ts` (new): construct
  `DrizzlePromptCategoryRepository` from `databaseClient.connect()` and export
  `listPromptCategoriesUseCase = new ListPromptCategoriesUseCase(repository)`.

**Migrations** (per `docs/database.md`, Drizzle Kit CLI, run manually):

1. `npx drizzle-kit generate` from the schema above to emit the
   `prompt_categories` table creation SQL into `drizzle/`.
2. A second, hand-authored data migration seeds the initial categories (per
   spec §1 "Initial data" and §6 Decision #2), inserting exactly the eleven
   rows listed in the spec. Per `docs/database.md`'s Column conventions, `id`
   is never database-generated, so the migration provides an explicit,
   hardcoded literal UUID (generated once, at authoring time) for each row:
   - `d290f1ee-6c54-4b01-90e6-d701748f0851` — Writing & Content
   - `c56a4180-65aa-42ec-a945-5fd21dec0538` — Marketing & Social Media
   - `f47ac10b-58cc-4372-a567-0e02b2c3d479` — Coding & Development
   - `9b2e3f1a-7c4d-4e8b-9a2f-1d3c5e7b9a0d` — Data & Analytics
   - `3fa85f64-5717-4562-b3fc-2c963f66afa6` — Business & Finance
   - `7c9e6679-7425-40de-944b-e07fc1f90ae7` — Learning & Research
   - `e8a1c2b3-4d5f-4a6b-8c7d-9e0f1a2b3c4d` — Productivity
   - `2f4a6b8c-1d3e-4f5a-9b7c-8d6e4f2a1b3c` — Design & UX
   - `5d4c3b2a-1e0f-4a9b-8c7d-6e5f4a3b2c1d` — Career & Job Search
   - `1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d` — Customer Support
   - `9f8e7d6c-5b4a-4c3d-9e2f-1a0b9c8d7e6f` — Legal & Compliance
3. Rollback: the table-creation migration's down step is `DROP TABLE
   prompt_categories;`; the seed migration's down step is `DELETE FROM
   prompt_categories WHERE id IN (<the eleven literal UUIDs above>);`. Both
   are written by hand alongside the generated SQL, since `drizzle-kit
   generate` only emits the forward (up) schema SQL, not seed data or down
   scripts.

## 8. Dependency changes

None. `drizzle-orm`, `drizzle-kit`, and `pg` are already installed and used
per `docs/database.md`; no new, updated, or removed packages are needed.

## 9. Assumptions and risks

**Assumptions**
1. Table name is `prompt_categories`, per `docs/database.md`'s "Owned
   entities" naming convention (which gives `prompt_categories` as its own
   worked example for the *PromptCategory* entity), rather than a bare
   `categories`. The `/categories` route name is unaffected — it is
   user-facing API naming, independent of the storage table name. If wrong,
   only the table/schema identifier changes; no behavior changes.
2. `id` is an application-generated UUID, provided by the caller on insert
   (never database-generated), per `docs/database.md`'s Column conventions.
   The eleven starter rows use fixed, hand-picked literal UUIDs authored
   directly in the seed migration (§7 step 2). If wrong, only the id
   generation/seeding mechanism changes; the domain and spec-level type
   remains an opaque `string`.
3. Ordering ties (two categories with the same name, case-insensitively) are
   broken by a secondary sort on `id`, to keep the result order deterministic
   for tests and API consumers. If wrong, only the tie-break rule changes;
   no impact on AC1/AC3, and current seed data (§7) has no duplicate names so
   this never triggers in practice.
4. Alphabetical ordering (AC2) is case-insensitive (`lower(name)`), so e.g.
   "business" and "Business" sort together as expected for a user-facing
   browsing list. If wrong, only the `ORDER BY` expression changes.
5. Handler file is named `src/handlers/GetCategories.ts` (PascalCase, verb +
   resource, default export), since `docs/architecture.md`'s only concrete
   example handler file is unnamed. If wrong, only a rename is needed.
6. Use case file is named identically to its exported class,
   `ListPromptCategoriesUseCase.ts`, per the explicit rule in
   `docs/architecture.md` ("filename equals class name"). If wrong, only a
   rename is needed.

**Risks**
1. *(low likelihood, medium impact)* Integration tests for the "no
   categories" case (AC3) run against a database that already has the seed
   migration applied (§7), so the `prompt_categories` table is never
   naturally empty. Mitigation: the relevant tests capture the pre-existing
   rows, delete them to exercise the empty state, assert the empty-list
   behavior, then restore the exact captured rows in a `finally`/`afterEach`
   block — satisfying `docs/testing.md`'s "leave everything else untouched"
   by restoring precisely what was temporarily removed.
2. *(low likelihood, low impact)* Since the seed migration hardcodes eleven
   literal UUIDs (§7 step 2) rather than relying on database generation,
   re-running the seed migration without a guard would attempt to insert
   duplicate primary keys. Mitigation: the migration is written to run
   exactly once (standard Drizzle Kit migration semantics — applied
   migrations are tracked and not re-run).
3. *(medium likelihood, low impact)* `src/logic/prompt/infrastructure/database/schema.ts`
   will later grow to include a `prompts` table when the prompt-management
   feature is built. Mitigation: keep the `prompt_categories` table as an
   additive, independently named export so future schema additions to the
   same file do not require changes here.

## 10. Edge cases

- Table has exactly one category → `findAll()`/`GET /categories` returns a
  single-element array.
- Table has no rows → `findAll()`/`GET /categories` returns `[]`, HTTP 200
  (AC3), never an error.
- Two categories share the same name (case-insensitive) → both are returned;
  order between them is determined by `id` (assumption 3), not left random.
- Category names with mixed case (e.g. "Design & UX" vs. a hypothetical
  "business") → ordering is case-insensitive (assumption 4).

## 11. Traceability

| Spec item | Plan element(s) |
|---|---|
| Field: id | `PromptCategory.id` (§2); `prompt_categories.id` column (§7); route response body (§5) |
| Field: name | `PromptCategory.name` (§2); `prompt_categories.name` column (§7); route response body (§5) |
| §3 (no validation rules) | §6 Zod schemas: none required |
| §4 (no error responses) | §5 Routes: no E# to map |
| §1 Initial data (eleven starter categories) | §7 Migrations, seed migration step 2 |
| AC1 | `ListPromptCategoriesUseCase` (§4); `DrizzlePromptCategoryRepository.findAll` (§7); `GET /categories` (§5) |
| AC2 | `DrizzlePromptCategoryRepository.findAll` ORDER BY (§7); `PromptCategoryRepositoryInterface.findAll` contract (§3) |
| AC3 | `ListPromptCategoriesUseCase` pass-through (§4); `DrizzlePromptCategoryRepository.findAll` on empty table (§7); `GET /categories` 200 with `[]` (§5) |
| Decision #1 (bounded context) | §1; §7 table naming |
| Decision #2 (starter data / empty state) | §1 Initial data (spec); §7 Migrations; §9 Risk 1 |
| Decision #3 (ordering) | §3, §7, §9 Assumption 4 |
