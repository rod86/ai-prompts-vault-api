# Plan — Prompt Categories Listing

> **Plan area, step 3.** HOW, mapped onto the architecture. No production code
> yet. See [docs/architecture.md](../../docs/architecture.md).

## Source spec

Link: `./spec.md`

## REST design decision

The story proposed `GET /prompts/categories`. Adjusted to REST conventions:

- **Route:** `GET /categories`
- **Why:** A category is a first-class collection resource with its own identity
  (`id`, `name`). Nesting it under `/prompts/...` collides with the item pattern
  `GET /prompts/{id}` (`categories` reads like a prompt id). A collection
  resource at `/categories` returns the full list; a future
  `GET /categories/{id}` fits the same scheme.

Response `200`:

```json
[
  { "id": "36f49137-14ce-4c1d-843f-ca18cfb67415", "name": "devops" },
  { "id": "a1b2c3d4-...", "name": "frontend" }
]
```

## Bounded context

`src/logic/prompts/` — **new** context (only `src/logic/shared` exists today).
Categories belong to the prompts area rather than a standalone context.

## Scope of this slice

Full vertical slice through HTTP: **domain + application + infrastructure**. The
domain and application layers are already done (proven with a mocked port); this
revision promotes the previously deferred infrastructure — repository adapter,
HTTP handler, route, and wiring — into the actual plan so `GET /categories`
serves real traffic.

## Domain layer

- **Entities / value objects:** `PromptCategory` — `{ id: string; name: string }`
  (in `prompts/domain`). Promotes the `PromptCategory` union in
  `docs/architecture.md` to an entity with identity.
- **Invariants:** `id` is a non-empty UUID; `name` is a non-empty string.
- **Ports:** `PromptCategoryRepositoryInterface` (in `prompts/domain/interfaces`)
  — `findAll(): Promise<PromptCategory[]>`, contract: returns categories ordered
  by name ascending. Port name references no source (no "Database", "Drizzle").
- **Domain errors:** none needed for this read-only listing.

## Application layer

- **Use cases:** `ListCategoriesUseCase` (in `prompts/application`).
  - **Input:** none (no `Query`).
  - **Output:** `ListCategoriesResponse` —
    `{ categories: { id: string; name: string }[] }` (native types only).
  - Calls `PromptCategoryRepositoryInterface.findAll()` and maps to the response,
    preserving the name-ascending order the port guarantees.
  - Port injected via the constructor; unit-tested against a mocked
    `PromptCategoryRepositoryInterface`.

## Infrastructure layer

The only place frameworks appear. Implements the domain port with Drizzle and
exposes the operation over HTTP.

- **Persistence:** `DrizzlePromptCategoryRepository` (in
  `src/logic/prompts/infrastructure/database/`) implements
  `PromptCategoryRepositoryInterface`, consuming the shared `databaseClient`
  (`src/logic/shared/database/DatabaseClient.ts`). The repo uses **Drizzle ORM**
  (`drizzle-orm/node-postgres`), **not Prisma**. `findAll()` issues a single
  parameterless `SELECT id, name FROM categories ORDER BY name ASC` and maps each
  row to a `PromptCategory`. To honor the spec's out-of-scope on schema/migration
  work, the query is a raw Drizzle `sql` statement against the **existing**
  `categories` table — **no Drizzle table/schema object is defined** and
  `config.ts`'s aggregated schema is untouched. Per `docs/architecture.md`, **no
  `InMemory` adapter is created** (InMemory adapters are explicitly forbidden).
- **HTTP:** `getCategoriesHandler` in `src/handlers` — one function per file,
  default export, no inline handlers. Route `GET /categories` →
  `getCategoriesHandler` → (via `services.ts`) `listCategoriesUseCase`; the
  handler reaches business logic only through the context's `services.ts`, never
  importing the use case or adapter directly. Success responds `200` with the
  JSON array of `{ id, name }`; a repository failure propagates to the trailing
  error-handling middleware → `500`. **No Zod schema** — the request takes no
  input, so there is nothing to validate at the boundary.
- **Wiring:** `src/logic/prompts/services.ts` (new) constructs
  `listCategoriesUseCase` as `new ListCategoriesUseCase(new
  DrizzlePromptCategoryRepository(databaseClient))`, importing `databaseClient`
  from `@logic/shared/services`.

## Edges / wiring

- [`src/app.ts`](../../src/app.ts): mount `GET /categories` →
  `getCategoriesHandler` after the leading `json()` middleware and **before** the
  trailing 404 handler and error-handling middleware. The error-handling
  middleware is where a repository/store-read failure is mapped to `500` — in one
  place, not in the handler.
- [`src/logic/prompts/services.ts`](../../src/logic/prompts/services.ts): the
  context's composition surface exposing `listCategoriesUseCase`.
- [`src/index.ts`](../../src/index.ts): already connects `databaseClient` on
  bootstrap; no change needed for this slice.

## Open questions / risks

- **Schema/table provisioning vs. spec out-of-scope.** The Drizzle adapter reads
  the `categories` table via raw SQL to avoid defining a Drizzle schema (keeping
  `spec.md`'s "no schema-definition/migration work" accurate). This assumes the
  `categories` table already exists and is seeded **out-of-band**. If the table
  is not provisioned, `findAll()` fails at runtime. Decision needed if the table
  does not yet exist: provision it outside this slice, or widen the spec to
  include a minimal schema/migration task.
- **DB-backed integration testing has no strategy yet.** `docs/tests.md` defers
  DB-backed integration until a test-DB strategy is defined. The adapter is
  unit-tested with a mocked node-postgres client (`vitest-mock-extended`), but
  the end-to-end `GET /categories` Supertest against `src/app.ts` exercises the
  wired Drizzle adapter and therefore needs either the test-DB strategy from
  `docs/tests.md` or a repository substituted at the composition edge. Flagged so
  it is resolved before the end-to-end task is implemented.
- **Stale ORM references in older docs.** `docs/spec-driven.md` and
  `docs/tests.md` still mention Prisma; the authoritative `docs/database.md`
  mandates Drizzle. This plan follows Drizzle.
