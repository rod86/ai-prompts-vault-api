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

Domain + application layers only. The **infrastructure layer is deferred** (see
below): no repository adapter, no HTTP handler/route, no wiring. The
`ListCategoriesUseCase` is proven with an inline fake of its port.

## Domain layer

- **Entities / value objects:** `PromptCategory` — `{ id: string; name: string }`
  (in `prompts/domain`). Promotes the `PromptCategory` union in
  `docs/architecture.md` to an entity with identity.
- **Invariants:** `id` is a non-empty UUID; `name` is a non-empty string.
- **Ports:** `CategoryRepositoryInterface` (in `prompts/domain/interfaces`) —
  `findAll(): Promise<PromptCategory[]>`, contract: returns categories ordered by
  name ascending. Port name references no source (no "Database", "Drizzle").
- **Domain errors:** none needed for this read-only listing.

## Application layer

- **Use cases:** `ListCategoriesUseCase` (in `prompts/application`).
  - **Input:** none (no `Query`).
  - **Output:** `ListCategoriesResponse` —
    `{ categories: { id: string; name: string }[] }` (native types only).
  - Calls `CategoryRepositoryInterface.findAll()` and maps to the response,
    preserving the name-ascending order the port guarantees.
  - Port injected via the constructor; unit-tested against an **inline fake**
    implementing `CategoryRepositoryInterface`.

## Infrastructure layer — deferred (out of scope for this slice)

Per decision, do **not** implement any adapter now. Documented for the later
slice, not built here:

- **Persistence:** `InMemoryCategoryRepository` first, then Drizzle-backed
  `DatabaseCategoryRepository` consuming the shared `databaseClient`
  (`src/logic/shared/database/DatabaseClient.ts` — the repo uses **Drizzle ORM**,
  not Prisma). **No ORM migration or table/schema definition is produced.**
- **HTTP:** `getCategoriesHandler` in `src/handlers` (one function per file,
  default export — no inline handlers), route `GET /categories` →
  `getCategoriesHandler` → `listCategoriesUseCase`; success `200` JSON array,
  repository failure → error handler `500`. No Zod schema (no input).
- **Wiring:** `src/logic/prompts/services.ts` constructs `listCategoriesUseCase`
  with the concrete repository; `src/app.ts` mounts the route before the trailing
  404/error middleware.

## Edges / wiring

None in this slice — the use case is not composed into `app.ts` until the
infrastructure slice provides a repository adapter.

## Open questions / risks

- The use case cannot serve real HTTP traffic until a repository adapter and
  route exist; the HTTP-level acceptance criteria in `spec.md` are verified in
  the deferred infrastructure slice.
- Seed/source of the actual category rows arrives with the deferred Drizzle
  adapter.
