# Implementer memory

Durable codepaths and concrete implementation/test patterns for
ai-prompts-vault-api. Design rationale lives in the planner's memory; this file
is where things live and how they're built.

## Codepaths (where things live)

- **Context tree:** `src/logic/prompt/{domain,application,infrastructure/database,services.ts}`.
- **Entities:** `domain/Prompt.ts`, `domain/PromptCategory.ts`.
- **Ports:** `domain/interfaces/<Entity>RepositoryInterface.ts` — plus
  `PromptFilter { categoryId?: string }` for the prompt port's `findAll(filter?)`.
- **Use cases:** `application/List<X>UseCase.ts` (`invoke()` returns
  `this.repository.findAll(...)`).
- **Adapters:** `infrastructure/database/Drizzle<Entity>Repository.ts` +
  `infrastructure/database/schema.ts` (tables `promptCategories`, `prompts`).
- **Handlers:** `src/handlers/Get{Categories,Prompts}.ts` (default export) +
  `src/handlers/schemas/GetPromptsQuerySchema.ts`.
- **Wiring:** `src/logic/prompt/services.ts` (exports `listPromptCategoriesUseCase`,
  `listPromptsUseCase`); `src/logic/shared/services.ts` (`databaseClient`);
  `src/config.ts` (schema aggregation `* as promptSchema`).
- **Routes:** registered in `src/app.ts` (`app.get('/categories', ...)`,
  `app.get('/prompts', ...)`).

## Drizzle patterns

- `pgTable(...)` in `schema.ts`.
- `uuid('id').primaryKey()` — **no** default; the caller always supplies the id.
- `text(...).notNull()` for required text; nullable `text('description')` for optional.
- FK: `.references(() => promptCategories.id)` (+ `.notNull()` when required).
- Timestamps: `timestamp('created_at', { withTimezone: true }).notNull()`.
- Read query: `.innerJoin(...).where(whereClause).orderBy(desc(createdAt), id)`.
- Case-insensitive order: `orderBy(sql\`lower(${col})\`, id)`.
- Optional filter clause: `filter?.categoryId ? eq(prompts.promptCategoryId, filter.categoryId) : undefined`.
- Optional column → domain: `description: row.description ?? undefined` (null→undefined).

## Testing patterns

- **Unit:** `mock<...RepositoryInterface>()` + `repository.findAll.mockResolvedValue(...)`
    - faker for fixtures; build the mock in `beforeEach`.
- **Integration:** open the DB in `beforeAll`; seed via `tests/lib/seeding`
  helpers (one helper per table); `afterEach` deletes **only** inserted rows;
  close in `afterAll`.
- **Empty-state trick:** capture existing rows, delete, assert `findAll()` → `[]`,
  then restore the captured rows in a `finally` block (the categories table is
  never naturally empty — it ships 11 seeded rows).
- **Prompt fixtures must seed a category first** — the FK is NOT NULL, so a
  prompt row needs an existing `prompt_categories` row.
- **Routes:** `supertest` against the real Express `app` in `tests/integration/app.test.ts`.

## Migrations

- `npx drizzle-kit generate` then `npx drizzle-kit migrate` — run manually; the
  app never migrates on startup, and there are no npm scripts.
- Seed rows and any down/reversal steps are hand-authored with literal UUIDs.

## Gotchas

- Repeated `?category=` yields an **array** in Express; the handler takes the
  first value before handing it to Zod.
- `innerJoin` silently drops a prompt whose FK is orphaned — prevented by the
  NOT NULL + FK constraint, so it should never happen, but don't switch to a
  left join without a reason.
- `zod` was installed by feature 002 as the first HTTP-input dependency.
