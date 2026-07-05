# Planner memory

Durable planning knowledge for ai-prompts-vault-api. Design/decision level only
(codepaths and concrete code patterns live in the implementer's memory).

## Specs delivered so far

- `specs/001-list-categories/` — `GET /categories`, alphabetical, seeded with 11
  starter categories. All tasks done.
- `specs/002-list-prompts/` — `GET /prompts` (+ optional `?category=` filter),
  most-recent-first, prompts carry a nested category reference.

## Bounded context

- Only **one** bounded context exists: `prompt` (`src/logic/prompt/`). It owns
  **both** `PromptCategory` and `Prompt` — categories are NOT a separate context
  (001 Decision #1). `Prompt` is the central entity. Default new prompt-domain
  features into this context unless there's a strong reason to add another.

## Domain vocabulary

- `PromptCategory { id, name }`.
- `Prompt { id, category: { id, name }, title, prompt, description?, createdAt,
  updatedAt }` — the category is a **nested reference** (id + name together), not
  a flat foreign key (002 Decision #2).

## Recurring design conventions (apply to future list/read features)

- **Empty list is a normal success** — HTTP 200 with `[]`, never an error. Call
  this out explicitly as an acceptance criterion.
- **Deterministic ordering** — every list defines an explicit order plus an `id`
  secondary tie-break so results are stable (categories: `lower(name)` then id;
  prompts: `createdAt` desc then id).
- **Adapter owns ordering/joining/filtering**, documented in the port contract;
  the use case just passes the result through, never re-sorts or re-filters.
- **Opaque filter values** — no format validation on user filter input; a
  non-matching value yields `[]`, not an error (002 Decision #4). Fold "no such
  category" and "category with no prompts" into a single empty-result AC.
- **Optional fields** → `T | undefined`, shown as absent (not `null`) in the
  response (002 AC6).
- **`id` is always application-provided** (UUID), never DB-generated.
- **Seed data vs empty state** — categories ship 11 starter rows via a
  hand-authored data migration, yet the empty state must still be supported and
  tested; prompts ship no seed data. Starter data is not a guaranteed invariant.
- **Zod at the HTTP boundary even with no V#** — if an endpoint takes any user
  input, plan a structural Zod schema at `src/handlers/schemas/`, even when the
  spec defines no validation rules (guards against unexpected shapes).

## Naming precedents (reuse verbatim)

- Handler file: `Get<Resource>.ts` (`GetCategories.ts`, `GetPrompts.ts`).
- Use case: `List<X>UseCase.ts`, filename = class name.
- Port: `<Entity>RepositoryInterface`; adapter: `Drizzle<Entity>Repository`.
- Tables: owned entity → prefixed (`prompt_categories`); standalone → plain
  plural (`prompts`); FK column → referenced entity + `_id` (`prompt_category_id`).
- Routes are user-facing and independent of table names (`/categories`, not
  `/prompt_categories`).

## Open threads

- No create/update/delete features yet — write shapes (flat `categoryId`, input
  validation V#) are deliberately deferred until a write feature needs them.
