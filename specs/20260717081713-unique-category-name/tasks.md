# Tasks: Unique category names
Plan: specs/20260717081713-unique-category-name/plan.md

Per the user's instruction this database-only change ships **without a new automated
test** (SDD "logic-less change" exception). AC1–AC3 are verified by generating and
applying the declarative migration. T1 is still required so the **existing** suite's
random-named category inserts cannot collide under the new index.

- [ ] T1. Harden the category model factory against name collisions
  - Type: infrastructure (test helper)
  - Depends on: none
  - Red: none — `PromptCategoryModelFactory` is a test helper; append a unique suffix
    to the generated `name` (e.g. `` `${faker.commerce.department()} ${faker.string.uuid()}` ``)
    so randomly generated categories cannot violate the unique index. Verified
    indirectly by the existing suite staying green after T2.
  - Green: `tests/lib/modelFactories/PromptCategoryModelFactory.ts` — make `create`
    produce a collision-proof default `name`; callers passing an explicit `name` are
    unaffected.
  - Covers: R1 mitigation — keeps existing tests from colliding on the faker-generated
    names (no AC).

- [ ] T2. Add the case-insensitive unique index + migration
  - Type: migration
  - Depends on: T1
  - Red: none — declarative schema/migration change, no application logic (per the
    logged decision to skip tests). Verified instead by: the emitted migration reads
    `CREATE UNIQUE INDEX "prompt_categories_name_unique" ON "prompt_categories" USING btree (lower("name"))`;
    `npm run db:migrate` applies it cleanly against the seed data; and `npm run typecheck`
    and the existing suite stay green.
  - Green: add `uniqueIndex('prompt_categories_name_unique').on(sql`lower(name)`)` to
    `promptCategories` in `src/config/drizzle/prompt.schema.ts`; run
    `npx drizzle-kit generate` to emit the migration and `npm run db:migrate` to apply it.
  - Manual verification (after applying the migration): against the running database,
    run the two inserts below — the first must succeed, the second must be rejected by
    the unique index (case-insensitive `Category1` vs `category1`) — then delete both
    ids so the check leaves no residue:
    ```sql
    INSERT INTO public.prompt_categories (id, name) VALUES ('b901297c-b9c7-42c8-85ca-af5bb54eb393', 'Category1');  -- succeeds
    INSERT INTO public.prompt_categories (id, name) VALUES ('222ed408-41f0-4797-82e3-085e3fe06f87', 'category1');  -- must fail (duplicate)
    DELETE FROM public.prompt_categories WHERE id IN ('b901297c-b9c7-42c8-85ca-af5bb54eb393', '222ed408-41f0-4797-82e3-085e3fe06f87');
    ```
  - Covers: AC1 "Given a category named \"Productivity\" exists, When storing another category whose name is \"Productivity\", Then the store rejects it and no second category is created."; AC2 "Given a category named \"Productivity\" exists, When storing another category whose name is \"productivity\" (same letters, different casing), Then the store rejects it and no second category is created."; AC3 "Given a category named \"Productivity\" exists, When storing a category whose name is a genuinely different name, Then it is stored successfully."; V1; E1

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a category named "Productivity" exists, When storing another category whose name is "Productivity", Then the store rejects it and no second category is created. | T2 (migration; no test per logged decision) |
| AC2 | Given a category named "Productivity" exists, When storing another category whose name is "productivity" (same letters, different casing), Then the store rejects it and no second category is created. | T2 (migration; no test per logged decision) |
| AC3 | Given a category named "Productivity" exists, When storing a category whose name is a genuinely different name, Then it is stored successfully. | T2 (migration; no test per logged decision) |
