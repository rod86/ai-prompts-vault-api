# Plan: List prompts
Spec: specs/002-list-prompts/spec.md
Status: READY FOR REVIEW

## 1. Bounded context

Owning context: **prompt** (`src/logic/prompt/`), the same context that
already owns `PromptCategory` (`specs/001-list-categories/`). Prompts are
the context's central entity — the context is literally named after them —
so no new context is created.

Cross-context interaction: none new. This feature reads `PromptCategory`
data (via a database join, see §7) but does not call
`PromptCategoryRepositoryInterface` or `ListPromptCategoriesUseCase`; the
existing `prompt_categories` table is reused as-is, unmodified.

## 2. Entities and value objects

**`Prompt`** (new) — `src/logic/prompt/domain/Prompt.ts`

The single domain entity for this feature, shaped directly for listing: it
carries a nested `category` reference (spec §2 `category.id` /
`category.name`; spec §6 Decision 2) rather than a flat foreign key. This
is the type the listing port (§3) and use case (§4) deal in end to end. A
separate flat-`categoryId` entity for future write features (create/
update) was considered and dropped as unnecessary speculative scope for
this feature — see the Decisions log entry below and §9 Assumption 1.

| Field | Type | From spec | Invariants |
|---|---|---|---|
| id | `string` | spec §2 `id` | none enforced by this read-only feature (spec §3) |
| category | `{ id: string; name: string }` | spec §2 `category.id` / `category.name` | none enforced by this read-only feature (spec §3) |
| title | `string` | spec §2 `title` | none enforced by this read-only feature (spec §3) |
| prompt | `string` | spec §2 `prompt` | none enforced by this read-only feature (spec §3) |
| description | `string \| undefined` | spec §2 `description` | optional (spec §2 Required = false) |
| createdAt | `Date` | spec §2 `createdAt` | none enforced by this read-only feature (spec §3) |
| updatedAt | `Date` | spec §2 `updatedAt` | none enforced by this read-only feature (spec §3) |

```ts
export interface Prompt {
  id: string;
  category: { id: string; name: string };
  title: string;
  prompt: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**`PromptCategory`** (existing) — `src/logic/prompt/domain/PromptCategory.ts`
(from `specs/001-list-categories/`). Reused unmodified as the source of
`category.id` / `category.name`.

## 3. Ports

**`PromptRepositoryInterface`** (new) —
`src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`

```ts
import { type Prompt } from '@logic/prompt/domain/Prompt';

export interface PromptFilter {
  categoryId?: string;
}

export default interface PromptRepositoryInterface {
  findAll(filter?: PromptFilter): Promise<Prompt[]>;
}
```

- `findAll()` returns every prompt (or only those matching `filter.categoryId`
  when supplied), each already joined with its category and already ordered
  most-recently-created-first (spec AC2), per §7 — ordering and joining are
  adapter responsibilities, not recomputed by the use case.
- `filter` is optional and, when its `categoryId` is supplied, is compared
  for an exact match only (spec §3); a value matching no row simply yields
  no results (spec AC5), never a rejected call.
- New port: no repository for prompts exists yet (first feature reading/
  writing prompts in this context, per prior exploration of the codebase).

## 4. Use cases

**`ListPromptsUseCase`** (new) —
`src/logic/prompt/application/ListPromptsUseCase.ts`

- Input: `ListPromptsQuery` — an optional `categoryId` filter.
- Output: `ListPromptsResponse[]`.
- Ports called: `PromptRepositoryInterface.findAll()`.
- AC satisfied: AC1, AC2, AC3 (pass-through of the adapter's ordered/
  filtered/possibly-empty result), AC4, AC5, AC6.

```ts
export interface ListPromptsQuery {
  categoryId?: string;
}

export interface ListPromptsResponse {
  id: string;
  category: { id: string; name: string };
  title: string;
  prompt: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ListPromptsUseCase {
  constructor(private readonly repository: PromptRepositoryInterface) {}

  public async invoke(query: ListPromptsQuery = {}): Promise<ListPromptsResponse[]> {
    return this.repository.findAll({ categoryId: query.categoryId });
  }
}
```

## 5. Routes

**`GET /prompts`** and **`GET /prompts?category={id}`**

- Request: optional query parameter `category` (plain string, no path
  params, no body). When present, its value is passed as `categoryId` to
  `ListPromptsUseCase.invoke()`; when absent, the use case is invoked with
  no filter.
- Response `200`: JSON array of
  `{ id, category: { id, name }, title, prompt, description, createdAt, updatedAt }`,
  ordered most-recently-created-first; `[]` when no prompts match (spec
  AC3, AC5). `description` is omitted from a given item when the prompt has
  none (spec AC6).
- Spec §4 defines no error responses (E#) for this operation, so there is
  nothing to map to a non-200 status code — every request that reaches the
  route succeeds with `200`.
- Handler: `src/handlers/GetPrompts.ts` (default export, mirroring
  `src/handlers/GetCategories.ts`), reaching business logic only via
  `src/logic/prompt/services.ts`.

## 6. Validation schemas

**`GetPromptsQuerySchema`** (new, Zod) —
`src/handlers/schemas/GetPromptsQuerySchema.ts`

```ts
import { z } from 'zod';

export const GetPromptsQuerySchema = z.object({
  category: z.string().optional(),
});
```

- Spec §3 defines no V# (no user-supplied value can be "invalid" for this
  operation) — this schema exists solely to satisfy `docs/coding-style.md`'s
  rule that all external input is validated with Zod at the HTTP boundary,
  guarding against a structurally unexpected query value (e.g. an
  object/array shape from a repeated `category` parameter) reaching the use
  case as something other than a plain string or `undefined`. See §9
  Assumption 6 for the handler's normalization of a repeated `category`
  parameter before this schema runs.
- Lives under `src/handlers/schemas/`, colocated with its handler
  (`GetPrompts.ts`), not under `src/logic/`: it validates the HTTP boundary
  itself, not context business logic, so it sits with the handler that owns
  that boundary (see §9 Assumption 5).

## 7. Persistence adapter

**Schema** (new, added to existing file) —
`src/logic/prompt/infrastructure/database/schema.ts`

```ts
export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey(),
  promptCategoryId: uuid('prompt_category_id')
    .notNull()
    .references(() => promptCategories.id),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
```

- Table: `prompts` — plain, unprefixed name per `docs/database.md`'s
  "Naming" convention (`Prompt` is not owned by another entity; it
  *references* `PromptCategory`, which is a different relationship than
  "owned entities" like `prompt_categories`).
- FK column: `prompt_category_id`, referencing `prompt_categories.id`, per
  `docs/database.md`'s Column conventions ("Foreign key columns are named
  after the referenced table's entity with an `_id` suffix") — the
  referenced entity is `PromptCategory`, giving `prompt_category_id` (see
  §9 Assumption 2). This storage-level FK column stays flat regardless of
  the domain entity's nested `category` shape (§2) — the adapter resolves
  it via a join (below), never storing a nested value.
- `id` is a `uuid` primary key with **no** `.defaultRandom()` default, same
  rule as `prompt_categories.id` (`docs/database.md`): always supplied by
  the caller/application on insert.
- `description` is the only nullable column — the sole field spec §2 marks
  Required = false; every other column is `NOT NULL` per the "Nullability &
  defaults" convention.
- `created_at`/`updated_at` are `timestamptz`, application-supplied in UTC,
  per the Column conventions' "Datetime columns" rule.
- No seed/starter data is added for `prompts` (see §9 Assumption 3) — unlike
  `prompt_categories`, spec §1 defines no starter set for prompts, so the
  table starts empty, which is itself a valid, exercised state (spec AC3).

**Repository adapter** (new) —
`src/logic/prompt/infrastructure/database/DrizzlePromptRepository.ts`
implements `PromptRepositoryInterface`:

```ts
public async findAll(filter?: PromptFilter): Promise<Prompt[]> {
  const whereClause = filter?.categoryId
    ? eq(prompts.promptCategoryId, filter.categoryId)
    : undefined;

  const rows = await this.db
    .select({
      id: prompts.id,
      title: prompts.title,
      prompt: prompts.prompt,
      description: prompts.description,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      categoryId: promptCategories.id,
      categoryName: promptCategories.name,
    })
    .from(prompts)
    .innerJoin(promptCategories, eq(prompts.promptCategoryId, promptCategories.id))
    .where(whereClause)
    .orderBy(desc(prompts.createdAt), prompts.id);

  return rows.map((row) => ({
    id: row.id,
    category: { id: row.categoryId, name: row.categoryName },
    title: row.title,
    prompt: row.prompt,
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}
```

- Joins `prompts` to `prompt_categories` on `prompt_category_id` so the
  nested `category` reference (spec §2, §6 Decision 2) is built in one
  query, per Decision 2's direction that "the adapter should join
  `prompt_categories` when reading."
- `orderBy(desc(prompts.createdAt), prompts.id)` satisfies AC2 (most-recent-
  first); `id` is a secondary, deterministic tie-break for rows sharing an
  identical `createdAt` (see §9 Assumption 4, mirroring the
  `001-list-categories` precedent's tie-break pattern).
- `description: row.description ?? undefined` maps a `NULL` column to an
  absent (`undefined`) domain value (spec AC6; `docs/coding-style.md`'s
  `T | undefined` rule).
- Domain↔storage mapping: `prompts.id` → `.id`; `prompts.prompt_category_id`
  joined to `prompt_categories.id`/`.name` → nested `.category`;
  `prompts.title` → `.title`; `prompts.prompt` → `.prompt`;
  `prompts.description` → `.description`; `prompts.created_at`/`updated_at`
  → `.createdAt`/`.updatedAt`.

**Wiring:**
- `src/config.ts`: no change needed — it already imports
  `* as promptSchema from '@logic/prompt/infrastructure/database/schema.js'`
  and spreads it into `database.schema`, so the new `prompts` export is
  picked up automatically once added to that file.
- `src/logic/prompt/services.ts`: add
  `const promptRepository = new DrizzlePromptRepository(databaseClient.connect());`
  and `export const listPromptsUseCase = new ListPromptsUseCase(promptRepository);`,
  alongside the existing category wiring.

**Migrations** (per `docs/database.md`, Drizzle Kit CLI, run manually):

1. `npx drizzle-kit generate` from the schema above to emit the `prompts`
   table creation SQL (including the FK constraint to `prompt_categories`)
   into `drizzle/`.
2. No data/seed migration is needed (§9 Assumption 3) — the table starts
   empty.
3. Rollback: the table-creation migration's down step is
   `DROP TABLE prompts;` (no dependent tables reference `prompts` yet, and
   dropping it does not affect `prompt_categories`).

## 8. Dependency changes

- **INSTALL** `zod` (`^3.23.0` or latest 3.x at implementation time) —
  needed for the query-parameter validation schema (§6); required by
  `docs/coding-style.md`'s "Validate all external input with Zod at the
  HTTP boundary" rule; this is the first feature in the codebase with any
  user-supplied HTTP input (query, path, or body) to validate, so `zod` is
  not yet a dependency.

## 9. Assumptions and risks

**Assumptions**
1. `Prompt` is the single domain type for this feature, with a nested
   `category` reference, rather than a separate flat-`categoryId` entity
   plus a distinct nested read-model. An earlier draft of this plan defined
   both; the flat-`categoryId` entity was removed during review as
   unnecessary speculative scope, since no create/update feature is in
   scope here and it was unused dead code. If a future feature needs a
   flat-FK write shape, it is introduced then, scoped to that feature.
2. FK column is named `prompt_category_id` (full referenced-entity name +
   `_id`), not the shorter `category_id`, per a literal reading of
   `docs/database.md`'s worked example ("`prompt_id` referencing
   `prompts.id`" — entity name, not table name, + `_id`). If wrong, only
   the column name and its one reference in the repository query change.
3. `prompts` has no starter/seed data, unlike `prompt_categories`: spec §1
   defines no initial prompt set, so the table is expected to start empty.
   If wrong, a follow-up migration adds seed rows with no change to this
   feature's read behavior (an empty table is already a tested state, AC3).
4. Ties in `createdAt` (AC2) are broken by a secondary sort on `id`
   ascending, mirroring `001-list-categories`'s tie-break precedent, so
   result order is deterministic for tests and API consumers. If wrong,
   only the `ORDER BY` expression's secondary key changes; no impact on
   AC1/AC3/AC4/AC5/AC6.
5. `GetPromptsQuerySchema` lives at `src/handlers/schemas/`, colocated with
   its handler, since no schema-location precedent exists yet in this
   codebase (first Zod usage) and `docs/architecture.md` does not prescribe
   a specific folder for HTTP-boundary schemas. If wrong, only the file's
   location changes, not its behavior.
6. If the `category` query parameter is supplied more than once (Express
   would parse it as an array), the handler takes only the first value
   before passing it to `GetPromptsQuerySchema`; spec §3/§6 Decision 4
   establish no format validation but do not address repeated parameters,
   and this is a trivial, non-behavior-changing normalization. If wrong,
   only the handler's normalization step changes.
7. Handler and use-case file names follow the existing precedent exactly:
   `GetPrompts.ts` mirrors `GetCategories.ts`; `ListPromptsUseCase.ts`
   mirrors `ListPromptCategoriesUseCase.ts` (`docs/architecture.md`,
   "filename equals class name"). If wrong, only renames are needed.

**Risks**
1. *(low likelihood, medium impact)* This is the first Zod dependency and
   first query-parameter validation in the codebase; ESLint's boundary
   rules (`eslint-plugin-boundaries`) have not been exercised against a
   `src/handlers/schemas/` folder before. Mitigation: colocate the schema
   with its handler (both outside `src/logic/`), avoiding any new
   cross-context or cross-layer import that boundary rules would flag.
2. *(medium likelihood, low impact)* `prompts.prompt_category_id` is
   `NOT NULL` with a `REFERENCES` constraint, so any test fixture must
   insert a valid category row before inserting a prompt row, or the
   insert fails at the database level. Mitigation: the prompt-seeding test
   helper (tasks.md) requires a `categoryId` argument and integration
   tests always seed a category first.
3. *(low likelihood, low impact)* The join in `findAll()` silently drops
   any prompt whose `prompt_category_id` no longer matches a row in
   `prompt_categories` (an orphaned FK), since it uses an inner join. This
   cannot occur under the stated invariants (the FK constraint prevents an
   orphaned insert), so no prompt is ever unexpectedly missing from the
   list under normal operation.

## 10. Edge cases

- No prompts exist at all → `findAll()`/`GET /prompts` returns `[]`, HTTP
  200 (AC3), never an error.
- A category filter value that exists but currently has zero prompts →
  returns `[]` (AC5), identical outcome to a filter value that matches no
  category at all.
- A category filter value that is not shaped like any existing id (e.g. an
  arbitrary string) → no format check is applied (spec §3, Decision 4); it
  is compared for an exact match like any other value and naturally
  returns `[]` (AC5).
- Two prompts share the exact same `createdAt` timestamp → both are
  returned; order between them is determined by `id` ascending (Assumption
  4), not left random.
- A prompt has no description → included in the list with `description`
  absent (AC6), not `null`, not an error, not excluded.
- The `category` query parameter is repeated (`?category=a&category=b`) →
  only the first value is used as the filter (Assumption 6).
- A category filter matches prompts spread across a wide `createdAt` range
  → the filtered subset is still returned most-recent-first (AC2 applies
  equally to the filtered and unfiltered flows).

## 11. Traceability

| Spec item | Plan element(s) |
|---|---|
| Field: id | `Prompt.id` (§2); `prompts.id` column (§7); route response body (§5) |
| Field: category.id / category.name | `Prompt.category` (§2); join to `prompt_categories` in `DrizzlePromptRepository.findAll` (§7); route response body (§5) |
| Field: title | `Prompt.title` (§2); `prompts.title` column (§7) |
| Field: prompt | `Prompt.prompt` (§2); `prompts.prompt` column (§7) |
| Field: description | `Prompt.description?` (§2); `prompts.description` nullable column (§7); AC6 |
| Field: createdAt | `Prompt.createdAt` (§2); `prompts.created_at` column (§7); ordering (§7 `orderBy`) |
| Field: updatedAt | `Prompt.updatedAt` (§2); `prompts.updated_at` column (§7) |
| §3 (no validation rules; opaque filter) | §6 `GetPromptsQuerySchema` (boundary-only, no V# traced); §3 `PromptFilter` contract |
| §4 (no error responses) | §5 Routes: no E# to map, every request resolves `200` |
| AC1 | `ListPromptsUseCase` (§4); `DrizzlePromptRepository.findAll` (§7); `GET /prompts` (§5) |
| AC2 | `DrizzlePromptRepository.findAll` `orderBy` (§7); `ListPromptsUseCase` pass-through (§4) |
| AC3 | `ListPromptsUseCase` pass-through (§4); `DrizzlePromptRepository.findAll` on empty table (§7); `GET /prompts` `200` with `[]` (§5) |
| AC4 | `PromptFilter.categoryId` (§3); `DrizzlePromptRepository.findAll` `whereClause` (§7); `GET /prompts?category=` (§5) |
| AC5 | `PromptFilter` "no validation" contract (§3); `DrizzlePromptRepository.findAll` non-matching filter (§7, §10); `GET /prompts?category=` `200` with `[]` (§5) |
| AC6 | `Prompt.description?` (§2); `description ?? undefined` mapping (§7); `GET /prompts` response (§5) |
| Decision #1 (prompt fields) | §2 `Prompt`; §7 `prompts` table columns |
| Decision #2 (nested category) | §2 `Prompt.category`; §3 port return type; §7 join |
| Decision #3 (ordering) | §7 `orderBy(desc(createdAt), id)`; §9 Assumption 4 |
| Decision #4 (no format validation on filter) | §3 `PromptFilter` contract; §6 `GetPromptsQuerySchema` (structural-only); §10 edge cases |
| Review decision (drop speculative flat-`categoryId` entity) | §2 `Prompt` (single type); §9 Assumption 1 |
