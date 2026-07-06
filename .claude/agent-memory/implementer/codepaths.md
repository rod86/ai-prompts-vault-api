---
name: codepaths
description: Where things live in ai-prompts-vault-api's prompt bounded context — entities, ports, use cases, adapters, handlers, middleware, wiring, routes
metadata:
  type: project
---

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
- **Delete pattern (`007-delete-prompt`):** simplest of the mutation use cases —
  port gets `delete(id: string): Promise<void>` (mirrors `findById`'s raw-id
  param); `Delete<X>UseCase.invoke()` looks up via `findById`, throws
  `<X>NotFoundError` if missing, else calls `repository.delete(id)`, returns
  `void` (no `Response` type). Adapter: `this.db.delete(table).where(eq(table.id,
  id))` (no `::text` cast — same "already confirmed to exist via findById"
  rationale as `update()`). Handler: 204 + `res.status(204).send()` on success
  (no body), 404 `{ error: message }` on the not-found error, mirroring
  `GetPromptHandler`/`UpdatePromptHandler`'s try/catch shape exactly.
- **Tightening an existing schema's path id to `z.uuid()` under a new spec's
  tasks.md:** a small maintenance task riding along with an unrelated feature
  (e.g. T9 of `007-delete-prompt` upgrading `UpdatePromptSchema`'s `params.id`
  from `z.string()` to `z.uuid()`) is legitimate when plan.md explicitly calls
  it out — just add the one new `it` to the existing handler's `Request
  Validation` describe block, run full suite to confirm no regression (all
  existing fixture ids/`faker.string.uuid()` values stay uuid-shaped so no
  passing test is affected).
