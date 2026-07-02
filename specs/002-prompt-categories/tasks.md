# Tasks — Prompt Categories Listing

> **Plan area, step 4.** An ordered, test-first checklist. Each task is one
> red→green step: write the failing test, then make it pass. No task bundles
> multiple behaviors. See [docs/spec-driven.md](../../docs/spec-driven.md).

## Source plan

Link: `./plan.md`

## Tasks

1. [x] **Domain entity** — failing unit test for `PromptCategory` invariants
       (`id` and `name` non-empty) → implement `PromptCategory`.
2. [x] **Port** — define `CategoryRepositoryInterface` with
       `findAll(): Promise<PromptCategory[]>` (name-ascending contract). No
       adapter; the contract is exercised through the use-case tests via an
       inline fake.
3. [x] **Use case: ListCategories** — failing unit test using an inline fake
       repo, asserting the use case returns all categories as `{ id, name }` in
       name-ascending order → implement `ListCategoriesUseCase`.
4. [x] **Use case: empty case** — failing unit test where the fake repo returns
       no categories, asserting an empty list and no error → make it pass.
5. [ ] **Repository adapter (Drizzle)** — failing unit test for
       `DrizzlePromptCategoryRepository.findAll()` using a mocked
       node-postgres/Drizzle client (`vitest-mock-extended`), asserting it selects
       `id, name` ordered by name ascending and maps rows to `PromptCategory[]` →
       implement the adapter in `src/logic/prompts/infrastructure/database/`
       against the existing `categories` table via a raw Drizzle `sql` query (no
       Drizzle schema object). Per `docs/architecture.md`, **no `InMemory`
       adapter is created.**
6. [ ] **HTTP handler + route (happy path)** — failing integration test
       (Supertest against `src/app.ts`): `GET /categories` returns `200` and a
       JSON array of `{ id, name }` items → implement `getCategoriesHandler`
       (`src/handlers`, one function per file, default export, reaching the use
       case only via `services.ts`), wire `listCategoriesUseCase` in
       `src/logic/prompts/services.ts` with `DrizzlePromptCategoryRepository`, and
       mount `GET /categories` in `src/app.ts`. No Zod schema (no input).
7. [ ] **Empty listing** — failing integration test: with no categories, `GET
       /categories` returns `200` and `[]` → make it pass.
8. [ ] **Store-read failure → 500** — failing integration test: when the
       repository throws, `GET /categories` returns `500` → add/confirm the
       trailing error-handling middleware (with a 404 handler ahead of it) that
       maps the failure to `500` in one place.

> Tasks 6–8 exercise the wired Drizzle adapter over HTTP. Per `docs/tests.md`,
> DB-backed integration has no test-DB strategy yet — resolve that (or substitute
> the repository at the composition edge) before implementing these.

## Verification

- [x] The domain/application acceptance criteria in `spec.md` map to passing
      unit tests (full list mapping, `{ id, name }` shape, empty list, name order).
- [ ] HTTP-level acceptance criteria in `spec.md` map to passing integration
      tests (`200` + list, exact `{ id, name }` shape, empty store → `200` + `[]`,
      deterministic name-ascending order, store-read failure → `500`).
- [ ] `npm test`, `npm run lint`, `npm run typecheck` are all clean.
