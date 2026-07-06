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
- **Handlers:** `src/handlers/{Get,Create,Update}Prompt{s,}Handler.ts` (default
  export) + `src/schemas/{Get,Create,Update}Prompt{s,}Schema.ts` (current
  location is `src/schemas/`, not `src/handlers/schemas/` — the latter is
  stale). Handlers read `req.parsedRequest?.params` / `?.body` (cast via
  `z.infer<typeof SomeSchema.params/body>`), populated by
  `validateRequestMiddleware` registered per-route in `app.ts` — never call
  `.parse()` themselves. Each write/lookup handler wraps its use-case call in
  a local `try/catch` mapping specific domain errors to status codes
  (`PromptNotFoundError` → 404, `CategoryNotFoundError` → 400), re-throwing
  anything else (no shared error middleware exists in this project).
- **Request validation middleware:** `src/middleware/validateRequest/{validation,validateRequestMiddleware}.ts`
  — sibling to `src/handlers/`, NOT under `src/logic/**` (cross-cutting HTTP
  infra with no business logic, so it's outside `eslint-plugin-boundaries`'
  tracked element types, same as `src/handlers/`). `validation.ts` is pure
  (no Express import): `validateRequestParts(schemas, request)` runs each
  part's `schema.safeParse(...)`, accumulates every failing part's issues
  (prefixed `part.fieldPath`) instead of stopping at the first, and returns
  a discriminated `{valid:true,data} | {valid:false,issues}`.
  `validateRequestMiddleware.ts` wraps it for Express, adding the
  `Request.validated?: Partial<Record<RequestPart, unknown>>` declaration-merging
  augmentation (`declare global { namespace Express { interface Request {...} } }`,
  needs `// eslint-disable-next-line @typescript-eslint/no-namespace` — this
  codebase has no prior precedent for augmenting Express's types, this is the
  first). On failure it responds `res.status(400).json({ message, issues })`
  directly and returns (no throw, no shared error middleware — deliberately
  out of scope per that feature's spec).
- **Wiring:** `src/logic/prompt/services.ts` (exports `listPromptCategoriesUseCase`,
  `listPromptsUseCase`, `getPromptUseCase`, `createPromptUseCase`,
  `updatePromptUseCase` — all reuse the same single `promptRepository`/
  `promptCategoryRepository` instances); `src/logic/shared/services.ts`
  (`databaseClient`); `src/config.ts` (schema aggregation `* as promptSchema`).
- **Routes:** registered in `src/app.ts` (`app.get('/categories', ...)`,
  `app.get('/prompts', validateRequestMiddleware(GetPromptsSchema), ...)`,
  `app.get('/prompts/:id', ...)`, `app.post('/prompts', ...)`,
  `app.put('/prompts/:id', ...)` — the plural list/create route and the
  `:id` routes coexist without conflict since Express only matches `:id` for
  `/prompts/<something>`, not `/prompts` itself). Per-route middleware is
  passed as an extra arg between the path and handler in the same
  `app.<verb>(...)` call, not registered separately via `app.use`.
- **Update pattern (full-replace, `006-update-prompt`):** a full-replacement
  update splits into: (1) a domain `Update<X>` type with every field
  optional except a system-assigned one like `updatedAt` (in the same file
  as the entity, e.g. `Prompt.ts`); (2) `<Repo>Interface.update(id, update)`
  taking the id separately (mirrors `findById(id)`, unlike `create(entity)`
  which has no separate lookup key); (3) the use case's `invoke()` still
  looks up and returns the **full** entity (preserving fields like
  `createdAt` from the pre-existing row), but only passes the narrower
  `Update<X>` — mapping `description ?? null` — to `repository.update()`;
  (4) the Drizzle adapter's `.set({...})` conditionally spreads each column
  (`...(update.field !== undefined && { column: update.field })`) so
  `undefined` fields are never written, while always-required fields like
  `updatedAt` are unconditional. `PromptNotFoundError` is checked (and
  thrown) before `CategoryNotFoundError` when both existence checks are
  needed, so "resource doesn't exist" always wins over "referenced value
  invalid".

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

- Repeated `?category=` yields an **array** in Express; as of the
  `validateRequestMiddleware`, this now fails `z.string().optional()` (since
  an array isn't a string) and surfaces as a 400 with `field: 'query.category'`
  — this is the intended, spec'd behavior (a real E1 case), not a bug. Before
  that middleware existed, handlers had to take the first array value manually.
- `innerJoin` silently drops a prompt whose FK is orphaned — prevented by the
  NOT NULL + FK constraint, so it should never happen, but don't switch to a
  left join without a reason.
- `zod` was installed by feature 002 as the first HTTP-input dependency.
- Splitting a single cohesive Green implementation (given verbatim in plan.md)
  across multiple granular Red/Green tasks (e.g. tasks.md T1+T2, or T3+T4)
  means the second task's test can pass immediately once the first task's
  Green step is written — not a defect, just an artifact of task granularity
  vs. a plan that hands over one complete function/file at once. Note it as a
  minor deviation in the completion report rather than treating it as a
  blocking Red-step failure.
