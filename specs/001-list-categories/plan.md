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
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
});
```

- Table: `categories`. `id` is a database-generated UUID; `name` is required
  text. No uniqueness constraint is required by this read-only feature
  (spec §3 has no validation rules); adding one is deferred to the future
  category-creation feature that will define that invariant.

**Repository adapter** (new) —
`src/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts`
implements `PromptCategoryRepositoryInterface`:

```ts
public async findAll(): Promise<PromptCategory[]> {
  return this.db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(sql`lower(${categories.name})`, categories.id);
}
```

- Ordering is case-insensitive alphabetical by name (`lower(name)`), with
  `id` as a secondary sort key so the result order is stable/deterministic
  when two categories share the same name (spec AC2; see §9 Assumption 3).
- Domain↔storage mapping is direct: `categories.id` → `PromptCategory.id`,
  `categories.name` → `PromptCategory.name`.

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

1. `npx drizzle-kit generate` from the schema above to emit the `categories`
   table creation SQL into `drizzle/`.
2. A second, hand-authored data migration seeds the initial categories (per
   spec §1 "Initial data" and §6 Decision #2), inserting exactly the eleven
   rows listed in the spec (name only — `id` is database-generated):
   - Writing & Content
   - Marketing & Social Media
   - Coding & Development
   - Data & Analytics
   - Business & Finance
   - Learning & Research
   - Productivity
   - Design & UX
   - Career & Job Search
   - Customer Support
   - Legal & Compliance
3. Rollback: the table-creation migration's down step is `DROP TABLE
   categories;`; the seed migration's down step is `DELETE FROM categories
   WHERE name IN (<the eleven names above>);`. Both are written by hand
   alongside the generated SQL, since `drizzle-kit generate` only emits the
   forward (up) schema SQL, not seed data or down scripts.

## 8. Dependency changes

None. `drizzle-orm`, `drizzle-kit`, and `pg` are already installed and used
per `docs/database.md`; no new, updated, or removed packages are needed.

## 9. Assumptions and risks

**Assumptions**
1. Table name is `categories` (not e.g. `prompt_categories`), matching the
   `/categories` route and the `name`/`id` field names directly. If wrong,
   only the table/schema identifier changes; no behavior changes.
2. `id` is a database-generated UUID (`defaultRandom()`, requiring the
   `pgcrypto` extension). If wrong (e.g. a serial integer id is preferred
   instead), only the schema column type and repository row mapping change;
   the domain and spec-level type remains an opaque `string`.
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
   migration applied (§7), so the `categories` table is never naturally
   empty. Mitigation: the relevant tests capture the pre-existing rows,
   delete them to exercise the empty state, assert the empty-list behavior,
   then restore the exact captured rows in a `finally`/`afterEach` block —
   satisfying `docs/testing.md`'s "leave everything else untouched" by
   restoring precisely what was temporarily removed.
2. *(low likelihood, low impact)* The `defaultRandom()` UUID generator
   depends on a Postgres extension (`pgcrypto`) being enabled. Mitigation:
   the table-creation migration includes `CREATE EXTENSION IF NOT EXISTS
   pgcrypto;` before the table statement.
3. *(medium likelihood, low impact)* `src/logic/prompt/infrastructure/database/schema.ts`
   will later grow to include a `prompts` table when the prompt-management
   feature is built. Mitigation: keep the `categories` table as an
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
| Field: id | `PromptCategory.id` (§2); `categories.id` column (§7); route response body (§5) |
| Field: name | `PromptCategory.name` (§2); `categories.name` column (§7); route response body (§5) |
| §3 (no validation rules) | §6 Zod schemas: none required |
| §4 (no error responses) | §5 Routes: no E# to map |
| §1 Initial data (eleven starter categories) | §7 Migrations, seed migration step 2 |
| AC1 | `ListPromptCategoriesUseCase` (§4); `DrizzlePromptCategoryRepository.findAll` (§7); `GET /categories` (§5) |
| AC2 | `DrizzlePromptCategoryRepository.findAll` ORDER BY (§7); `PromptCategoryRepositoryInterface.findAll` contract (§3) |
| AC3 | `ListPromptCategoriesUseCase` pass-through (§4); `DrizzlePromptCategoryRepository.findAll` on empty table (§7); `GET /categories` 200 with `[]` (§5) |
| Decision #1 (bounded context) | §1 |
| Decision #2 (starter data / empty state) | §1 Initial data (spec); §7 Migrations; §9 Risk 1 |
| Decision #3 (ordering) | §3, §7, §9 Assumption 4 |
