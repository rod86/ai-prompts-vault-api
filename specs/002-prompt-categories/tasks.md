# Tasks — Prompt Categories Listing

> **Plan area, step 4.** An ordered, test-first checklist. Each task is one
> red→green step: write the failing test, then make it pass. No task bundles
> multiple behaviors. See [docs/spec-driven.md](../../docs/spec-driven.md).

## Source plan

Link: `./plan.md`

## Tasks (this slice — domain + application)

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

## Deferred (not in this slice — infrastructure)

Per "ignore infrastructure for now". Tracked here, implemented later:

- [ ] Repository adapter: `InMemoryCategoryRepository`, then Drizzle-backed
      `DatabaseCategoryRepository`. **No ORM migration/schema.**
- [ ] `getCategoriesHandler` + `GET /categories` route; Supertest integration
      (`200` + item shape, empty store → `200` + `[]`).
- [ ] Wire `listCategoriesUseCase` in `src/logic/prompts/services.ts` and mount
      the route in `src/app.ts`; end-to-end Supertest.

## Verification

- [x] The domain/application acceptance criteria in `spec.md` map to passing
      unit tests (full list mapping, `{ id, name }` shape, empty list, name order).
- [x] `npm test`, `npm run lint`, `npm run typecheck` are all clean.
- [ ] HTTP-level acceptance criteria in `spec.md` are verified in the deferred
      infrastructure slice.
