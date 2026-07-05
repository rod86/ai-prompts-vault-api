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
  `this.repository.findAll(...)`); single-item fetch use cases are
  `application/Get<X>UseCase.ts` (`invoke(id)` calls `repository.findById(id)`,
  throws a domain `<X>NotFoundError` when it resolves `undefined`).
- **Domain errors:** `domain/errors/<X>NotFoundError.ts` — `extends Error`,
  sets `this.name`, message like `` `${X} not found: ${id}` ``. (No
  `Object.setPrototypeOf` needed in this codebase's precedent — plain
  `extends Error` is what's actually used, despite the hexagonal-architecture
  skill's example showing it.)
- **Adapters:** `infrastructure/database/Drizzle<Entity>Repository.ts` +
  `infrastructure/database/schema.ts` (tables `promptCategories`, `prompts`).
  A single-row `findById(id)` mirrors `findAll`'s join/mapping exactly, just
  adds `.where(eq(sql\`${table.id}::text\`, id)).limit(1)` and returns
  `rows[0] ? mapped : undefined`.
- **Handlers:** `src/handlers/Get{Categories,Prompts,Prompt}.ts` (default
  export) + `src/handlers/schemas/Get{Prompts,Prompt}{Query,Params}Schema.ts`.
  A by-id handler parses `req.params` (not `req.query`) with a
  `z.object({ id: z.string() })` schema, then wraps the use-case call in
  `try/catch`, catching only the specific `NotFoundError` locally for a 404
  `{ error: message }` response and re-throwing anything else (no shared
  error middleware exists yet in this project as of 003-get-prompt).
- **Wiring:** `src/logic/prompt/services.ts` (exports `listPromptCategoriesUseCase`,
  `listPromptsUseCase`, `getPromptUseCase` — the latter reuses the same
  `promptRepository` instance as `listPromptsUseCase`); `src/logic/shared/services.ts`
  (`databaseClient`); `src/config.ts` (schema aggregation `* as promptSchema`).
- **Routes:** registered in `src/app.ts` (`app.get('/categories', ...)`,
  `app.get('/prompts', ...)`, `app.get('/prompts/:id', ...)` — the plural list
  route must be registered before or after the `:id` route without conflict
  since Express only matches `:id` for `/prompts/<something>`, not `/prompts`
  itself).

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
- **Unit-test builder for a domain entity missing an optional field:** the
  model factory's `create(data)` pattern (`data.field ?? faker...`) cannot
  produce an explicitly-`undefined` optional field, since `undefined ?? x`
  falls through to the faker default. To build a fixture with a field forced
  absent, destructure it off an already-built object instead:
  `const { description: _description, ...rest } = buildPrompt();` — never pass
  `{ description: undefined }` into the factory expecting it to stick.

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
