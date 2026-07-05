# Planner memory

Durable planning knowledge for ai-prompts-vault-api. Design/decision level only
(codepaths and concrete code patterns live in the implementer's memory).

## Specs delivered so far

- `specs/001-list-categories/` — `GET /categories`, alphabetical, seeded with 11
  starter categories. All tasks done.
- `specs/002-list-prompts/` — `GET /prompts` (+ optional `?category=` filter),
  most-recent-first, prompts carry a nested category reference.
- `specs/003-get-prompt/` — `GET /prompts/:id`, 404 via local per-handler
  try/catch (no shared error middleware yet at that point).
- `specs/004-request-validation-middleware/` — cross-cutting `src/middleware/`.
  Final shape (after a follow-up user correction reversed the initial design,
  see below): a single `validateRequestMiddleware({ body?, params?, query? })`
  that validates/combines several request parts in one call and responds
  `400` with combined issues **directly** — no separate shared error-handling
  middleware exists in this codebase. See "Cross-cutting / non-domain
  features" below before planning another middleware, cross-context utility,
  or anything living outside `src/logic/**`.

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

## Cross-cutting / non-domain features (middleware, shared infra)

- `src/middleware/` (sibling to `src/handlers/`) holds cross-cutting Express
  middleware — not owned by any bounded context, not under `src/logic/**`, so
  it falls outside the boundaries-plugin's tracked element types (only
  `src/logic/*/{domain,application,infrastructure}` + `src/logic/shared` are
  covered in `.eslintrc.json`). plan.md §1 "Bounded context" for such a feature
  should say so explicitly rather than force-fitting it into `prompt`.
- Middleware files: one function per file, **named** export (not default,
  unlike handlers), suffixed `Middleware` (`validateRequestMiddleware.ts`) —
  confirmed by `project-stack` skill's own example. The **folder** holding a
  middleware's files does NOT need the `Middleware` suffix even though the
  file/export inside it does — e.g. `src/middleware/validateRequest/` holds
  `validateRequestMiddleware.ts` (the export) — a user-directed naming split
  worth defaulting to for future multi-file middleware.
- A middleware needing more than one file (e.g. an Express-facing wrapper
  plus pure types/logic with no framework import) gets its **own subfolder**
  under `src/middleware/`, split as: one thin file importing Express types
  and doing only req/res/next wiring, one pure file with types + logic and
  zero framework imports (easier to unit-test without any Express mocking
  beyond plain objects).
- 004 ended up with **no shared/global error-handling middleware at all** —
  a user correction reversed the initial plan (which had added an
  `errorMiddleware` catching a thrown `RequestValidationError` plus a
  generic 500 fallback). The validating middleware now responds
  `res.status(400).json(...)` **directly**, synchronously, no throw, no
  separate error class. Lesson: don't assume a validation-rejection
  mechanism implies a thrown-error/catch-middleware architecture — "emit the
  response inline, in the same middleware" is an equally valid, simpler
  default when nothing else forces a shared catch-all to exist yet.
- **A user can override their own already-answered interview decisions in a
  later message, without a new interview round** — when they do, treat it as
  a direct instruction (not ambiguous), apply it, and update the spec's
  Decisions log to explicitly mark the old entries as "superseded by #N"
  rather than deleting them, so the log stays an honest history of how the
  design evolved.
- When designing a "reject malformed input" feature, remember `req.params`
  values are always plain strings (can never be made malformed shape-wise
  through real HTTP) and Express's default query parser mode affects whether
  bracket notation (`a[b]=c`) nests — but a **repeated query key**
  (`?x=a&x=b`) reliably becomes an array under any parser, which is a robust,
  parser-independent way to make a real HTTP request fail a `z.string()`
  schema for an end-to-end test, without touching the schema itself.
- Storing a Zod-parsed value for a handler to consume without re-parsing:
  augment Express's `Request` type (declaration merging) with a dedicated
  property (e.g. `req.validated.<part>`) instead of overwriting
  `req.body`/`req.params`/`req.query` directly — sidesteps Express 5 making
  some of those properties non-writable/getter-only in some configs.
- Recurring interview-worthy design axes for a "generic mechanism" feature
  (validation/error-handling middleware, rate limiting, auth, etc.): (1) how
  much detail leaks to the caller on failure, (2) whether the new mechanism
  fully replaces existing per-feature handling or is scoped to net-new/unknown
  cases (a scope cut is a legitimate, low-risk default — offer it), (3) the
  exact granularity of one "unit" of the mechanism (e.g. one schema/one
  request-part per call vs. a combined shape).

## Open threads

- No create/update/delete features yet — write shapes (flat `categoryId`, input
  validation V#) are deliberately deferred until a write feature needs them.
- 004 has **no** shared/global error-handling middleware and no scaffolding
  toward one (a user correction removed that entirely — see "Cross-cutting /
  non-domain features" above). Centralizing domain-error-to-status mapping
  (e.g. `PromptNotFoundError` → 404, still handled per-handler) remains fully
  open/unstarted — treat it as a fresh design question, not a "continue a
  deferred plan," if a future feature raises it.
