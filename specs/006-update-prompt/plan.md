# Plan: Update prompt

Spec: specs/006-update-prompt/spec.md

## 1. Bounded context

Owning context: **prompt** (`src/logic/prompt/`), the same context that
already owns `Prompt` and `PromptCategory` (`specs/001-list-categories/`,
`specs/002-list-prompts/`, `specs/003-get-prompt/`, `specs/005-create-prompt/`).
This feature replaces the fields of an existing `Prompt`, validating it
against an existing `PromptCategory` in the same context; no new context is
created.

Cross-context interaction: none new. The use case reads the existing `Prompt`
and the referenced `PromptCategory` via their existing repository ports
(§3), and writes the updated `Prompt` via a new `PromptRepositoryInterface`
method — both already owned by this context.

## 2. Entities and value objects

**`Prompt`** (existing, unchanged) — `src/logic/prompt/domain/Prompt.ts`. The
entity replaced by this feature; reused exactly as defined for
`003-get-prompt`/`005-create-prompt`, since spec §2 defines the identical
field set for the returned prompt.

**`PromptCategory`** (existing, unchanged) —
`src/logic/prompt/domain/PromptCategory.ts`. Looked up (not created) by this
feature, to validate the supplied category reference (spec V3/E2) and to
supply `category.name` in the assembled response (spec §2).

**`PromptNotFoundError`** (existing, reused) —
`src/logic/prompt/domain/errors/PromptNotFoundError.ts` (introduced by
`003-get-prompt`). Thrown when the path-supplied id matches no existing
prompt. Satisfies spec §4 E1 / AC10 / AC11.

**`CategoryNotFoundError`** (existing, reused) —
`src/logic/prompt/domain/errors/CategoryNotFoundError.ts` (introduced by
`005-create-prompt`). Thrown when the supplied category reference is
UUID-shaped but matches no existing category. Satisfies spec §4 E2 / AC9.

No new domain error classes are needed: both failure conditions this feature
introduces already have an existing, semantically-matching error class.

**`UpdatePrompt`** (new value object) — added to
`src/logic/prompt/domain/Prompt.ts`, alongside the existing `Prompt` entity.
Represents "what to change" on an update, as opposed to `Prompt`, which
represents "what a prompt is" (the full entity, always used for reads and for
the use case's return value, §4).

```ts
export interface UpdatePrompt {
    categoryId?: string;
    title?: string;
    prompt?: string;
    description?: string | null;
    updatedAt: Date;
}
```

- Every field is optional except `updatedAt` (always refreshed by the
  caller, per `coding-style`'s "domain functions are pure — no I/O, clock, or
  randomness; inject those" rule — mirrors `UpdatePromptQuery.updatedAt`,
  §4).
- This is an internal-only, logic/persistence-layer refinement: the current
  HTTP contract (spec V1-V4) still requires every field on every request, so
  in practice `UpdatePrompt` is always built with every field defined. Typing
  the port and adapter around a genuine partial shape future-proofs them for
  a real partial-patch feature, should one ever be planned, without any
  further port-level change — only the HTTP-layer schema would need to relax
  at that point. Nothing about spec.md's behavior changes because of this
  type; the request still requires `title`, `prompt`, `category_id`, and the
  `description` key (V1-V4).
- `description: string | null` (not `string | undefined`) because the
  repository/persistence boundary works directly with the nullable database
  column shape (§7) — the use case is responsible for translating the
  domain's `description?: string` (absent = cleared) into this port-level
  `null`, mirroring the existing `description ?? null` mapping already used
  by `create()` (`005-create-prompt` plan.md §7).

## 3. Ports

**`PromptRepositoryInterface`** (existing, extended) —
`src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`

```ts
import { type Prompt, type UpdatePrompt } from '@logic/prompt/domain/Prompt.js';

export interface PromptFilter {
    categoryId?: string;
}

export default interface PromptRepositoryInterface {
    findAll(filter?: PromptFilter): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt | undefined>;
    create(prompt: Prompt): Promise<void>;
    update(id: string, prompt: UpdatePrompt): Promise<void>;
}
```

- `update()` is new: takes `id` as its own parameter (mirroring `findById(id:
  string)`'s convention of addressing a row by a raw id, rather than folding
  it into the value object) and an `UpdatePrompt` carrying only the fields to
  change, since `UpdatePrompt` itself carries no `id` field (§2). This
  differs from `create(prompt: Prompt)`, which takes the full entity in one
  argument because a create has no separate "which row" concern — the id is
  part of what's being created, not a lookup key. Returns nothing (per
  `hexagonal-architecture`'s "omit `Response` only when the use case returns
  a domain entity or nothing (`void`) directly").
- The adapter (§7) only writes the columns corresponding to fields actually
  defined on the passed `UpdatePrompt` (skipping `undefined` keys); `id` and
  `createdAt` are never part of `UpdatePrompt` and so can never be
  overwritten by this method, regardless of caller behavior.
- `findById()` (existing, reused unchanged) is used by the use case both to
  check the prompt exists (spec E1/AC10) and to read its current `createdAt`
  to preserve it (spec §2, AC1).

**`PromptCategoryRepositoryInterface`** (existing, unchanged) —
`src/logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.ts`.
`findById()` (added by `005-create-prompt`) is reused as-is to validate the
supplied category reference (spec V3/E2).

## 4. Use cases

**`UpdatePromptUseCase`** (new) —
`src/logic/prompt/application/UpdatePromptUseCase.ts`

- Input: `UpdatePromptQuery`.
- Output: `Promise<Prompt>` (returns the domain entity directly — no
  `Response` type, per `hexagonal-architecture`'s convention, matching
  `GetPromptUseCase`/`CreatePromptUseCase`).
- Ports called: `PromptRepositoryInterface.findById()`,
  `PromptCategoryRepositoryInterface.findById()`,
  `PromptRepositoryInterface.update()`.
- AC satisfied: AC1 (assembles the full replacement in memory, persists it
  via `UpdatePrompt`, preserving `createdAt` and refreshing `updatedAt`),
  AC2/AC3 (pass-through of the supplied `description`, whether absent or any
  text), AC9 (throws `CategoryNotFoundError` when the category repository
  returns `undefined`, without calling `update`), AC10/AC11 (throws
  `PromptNotFoundError` when the prompt repository returns `undefined` for
  the given id, checked **before** the category lookup, without calling
  `update`).

```ts
import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt, type UpdatePrompt } from '@logic/prompt/domain/Prompt.js';

export interface UpdatePromptQuery {
    id: string;
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
    updatedAt: Date;
}

export class UpdatePromptUseCase {
    constructor(
        private readonly promptRepository: PromptRepositoryInterface,
        private readonly categoryRepository: PromptCategoryRepositoryInterface,
    ) {}

    public async invoke(query: UpdatePromptQuery): Promise<Prompt> {
        const existingPrompt = await this.promptRepository.findById(query.id);

        if (!existingPrompt) {
            throw new PromptNotFoundError(query.id);
        }

        const category = await this.categoryRepository.findById(query.categoryId);

        if (!category) {
            throw new CategoryNotFoundError(query.categoryId);
        }

        const updatePrompt: UpdatePrompt = {
            categoryId: query.categoryId,
            title: query.title,
            prompt: query.prompt,
            description: query.description ?? null,
            updatedAt: query.updatedAt,
        };

        await this.promptRepository.update(query.id, updatePrompt);

        return {
            id: query.id,
            category,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: existingPrompt.createdAt,
            updatedAt: query.updatedAt,
        };
    }
}
```

- The use case still assembles and returns the **full** `Prompt` entity
  (unchanged from before this refinement) — only what gets passed to
  `promptRepository.update()` changes, from a full `Prompt` to the new,
  narrower `UpdatePrompt`. The returned `Prompt` and the persisted
  `UpdatePrompt` are built from the same source values (`query` + `category`
  + `existingPrompt.createdAt`), so they can never disagree.
- `query.description ?? null` translates the domain-level "absent means
  cleared" convention (`description?: string`) into `UpdatePrompt`'s
  port-level nullable shape, mirroring `create()`'s existing
  `description ?? null` mapping (`005-create-prompt` plan.md §7) — moving
  this one step earlier (into the use case) than before, since `UpdatePrompt`
  itself is typed `string | null`, not `string | undefined` (§2).
- `PromptNotFoundError` is checked **before** `CategoryNotFoundError` (spec
  E1's precedence over E2, AC11): a prompt that does not exist is never
  updated regardless of any other problem with the request.
- Per `coding-style`'s "domain functions are pure — no I/O, clock, or
  randomness; inject those" rule, `updatedAt` is generated by the caller
  (`UpdatePromptHandler`, §5) and passed in on the query — the use case
  itself never calls `new Date()`. `createdAt` is never regenerated; it is
  always carried forward from `existingPrompt` (spec §2).
- No re-fetch after `update()`: the returned `Prompt` is assembled in-memory
  from the query fields, the already-looked-up `category`, and the
  already-fetched `existingPrompt.createdAt`, satisfying spec AC1 without a
  second database round trip.

## 5. Routes

**`PUT /prompts/:id`**

- Request: path parameter `id` (plain string), and body
  `{ title: string, prompt: string, category_id: string, description: string | null }`
  (snake_case wire field `category_id`, mapped to the use case's
  `categoryId`; the wire-level `description: null` maps to the domain's
  `description: undefined`, mirroring `003-get-prompt`/`005-create-prompt`'s
  `T | undefined` convention for absent values, per `coding-style`).
- Response `200`: JSON object
  `{ id, category: { id, name }, title, prompt, description, createdAt, updatedAt }`
  (spec AC1) — the same shape `GetPromptHandler`/`CreatePromptHandler`
  return; `description` is omitted when its value is absent (spec AC2).
- Response `400` (V1/V2/V3/V4 — malformed request): body
  `{ message: 'The request was invalid.', errors: [{ field, error }] }`, via
  the existing shared `validateRequestMiddleware`
  (`004-request-validation-middleware`) — covers a missing/blank `title`
  (V1), missing/blank `prompt` (V2), a missing or non-UUID-shaped
  `category_id` (V3), and a missing `description` field (V4), including
  several at once (spec AC8).
- Response `404` (E1 — prompt not found): body `{ error: string }` (e.g.
  `{ "error": "Prompt not found: <id>" }`) — triggered when the path `id`
  matches no existing prompt (spec AC10/AC11). Mirrors `GET /prompts/:id`'s
  `404` (`003-get-prompt` plan.md §5), since this is a missing
  URL-addressed resource.
- Response `400` (E2 — category invalid): body `{ error: string }` (e.g.
  `{ "error": "Category not found: <id>" }`) — triggered when `category_id`
  is UUID-shaped but matches no existing category, and only once the prompt
  itself was found (spec AC9). Mirrors `POST /prompts`'s `400` E1
  (`005-create-prompt` plan.md §5): a business-rule check on a body field
  of a write operation, not a missing URL-addressed resource.
- Handler: `src/handlers/UpdatePromptHandler.ts` (default export, mirrors
  `CreatePromptHandler.ts`'s structure), reaching business logic only via
  `src/logic/prompt/services.ts`.
- Error mapping: handled locally inside `UpdatePromptHandler.ts` via
  `try/catch` around `updatePromptUseCase.invoke(...)` — catches
  `PromptNotFoundError` specifically and responds `404` with its message,
  catches `CategoryNotFoundError` specifically and responds `400` with its
  message; any other thrown error is re-thrown (not swallowed), matching
  `coding-style`'s "no swallowed catches" rule and the same local-handling
  precedent as `GetPromptHandler.ts`/`CreatePromptHandler.ts` (no
  shared/global error-handling middleware exists in this codebase, per
  `004-request-validation-middleware` plan.md §3).

## 6. Validation schemas

**`UpdatePromptSchema`** (new, Zod) — `src/schemas/UpdatePromptSchema.ts`

```ts
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    params: z.object({ id: z.string() }),
    body: z.object({
        title: z.string({ error: 'Missing required value' }).min(1),
        prompt: z.string({ error: 'Missing required value' }).min(1),
        category_id: z.string({ error: 'Missing required value' }).uuid('Invalid UUID value'),
        description: z.string().nullable(),
    }),
} satisfies RequestSchema;
```

- `params.id: z.string()` — spec §3 defines no validation rule for the path
  id itself (a value matching no prompt is E1, not a shape error); present
  only to satisfy `coding-style`'s "validate all external input with Zod at
  the HTTP boundary" rule, mirroring `GetPromptSchema.params`
  (`003-get-prompt` plan.md §6).
- `title: z.string({ error: 'Missing required value' }).min(1)` traces to V1.
- `prompt: z.string({ error: 'Missing required value' }).min(1)` traces to
  V2.
- `category_id: z.string({ error: 'Missing required value' }).uuid('Invalid UUID value')`
  traces to V3 — the format check only; a well-formed but non-existent id is
  not caught here (see E2, §4).
- `description: z.string().nullable()` traces to V4 — the field is required
  (unlike `CreatePromptSchema`'s `.optional()`), but its value may be `null`
  or any string, including `""`. A request omitting the `description` key
  entirely fails this schema with the same "Required"-shaped Zod error as
  any other required field.
- Lives under `src/schemas/`, colocated with `GetPromptSchema.ts`/
  `CreatePromptSchema.ts`, per the current repository layout
  (`005-create-prompt` plan.md §6).
- Consumed by `validateRequestMiddleware(UpdatePromptSchema)` (§5); the
  handler reads the parsed value from `req.parsedRequest?.params`/`?.body`,
  never calling `.parse()` itself, mirroring `GetPromptHandler.ts`/
  `CreatePromptHandler.ts`.

## 7. Persistence adapter

**Schema:** no change — `src/logic/prompt/infrastructure/database/schema.ts`
already defines every column this feature needs (`prompts.id`,
`.promptCategoryId`, `.title`, `.prompt`, `.description`, `.updatedAt`).
`.createdAt` is read but never written by this feature.

**`DrizzlePromptRepository`** (existing file, extended) —
`src/logic/prompt/infrastructure/database/DrizzlePromptRepository.ts` adds
`update`:

```ts
public async update(id: string, prompt: UpdatePrompt): Promise<void> {
    await this.db
        .update(prompts)
        .set({
            ...(prompt.categoryId !== undefined && { promptCategoryId: prompt.categoryId }),
            ...(prompt.title !== undefined && { title: prompt.title }),
            ...(prompt.prompt !== undefined && { prompt: prompt.prompt }),
            ...(prompt.description !== undefined && { description: prompt.description }),
            updatedAt: prompt.updatedAt,
        })
        .where(eq(prompts.id, id));
}
```

- Each column is only included in the `.set({...})` call when the
  corresponding `UpdatePrompt` field is actually defined (conditional
  spread), rather than unconditionally overwriting every column — `id` and
  `createdAt` have no `UpdatePrompt` field at all, so they can never be
  written by this method. Given the current HTTP contract (spec V1-V4),
  `UpdatePromptUseCase` (§4) always builds an `UpdatePrompt` with every field
  defined, so in practice this always updates every column — the
  conditional-spread form is intentional future-proofing for a genuine
  partial update, documented once here rather than re-justified per field
  (§2).
- `updatedAt` is unconditional (not spread) because `UpdatePrompt.updatedAt`
  is itself a required field (§2) — always defined by construction.
- `description: prompt.description` is written as-is, with no `?? null`
  mapping at this layer (unlike `create()`, `005-create-prompt` plan.md §7)
  — `UpdatePrompt.description` is already typed `string | null` (§2), so the
  domain-to-storage null mapping happens once, earlier, in
  `UpdatePromptUseCase` (§4), not duplicated here.
- A category's `name` is never a column and remains out of scope here — only
  `prompt.categoryId` (mapped to `promptCategoryId`) is written, consistent
  with `create()`'s mapping and `prompt_category_id` being the sole FK
  column on `prompts` (`database-modeling` skill's FK column convention).
- Filters by `eq(prompts.id, id)` (no `::text` cast, unlike `findById`): by
  the time `update()` is called, `UpdatePromptUseCase` has already confirmed
  a row with this exact `id` exists via `findById`, so `id` is always a
  genuine, well-formed `uuid` value here.

**Wiring:**

- `src/logic/prompt/services.ts`: add
  `export const updatePromptUseCase = new UpdatePromptUseCase(promptRepository, promptCategoryRepository);`,
  reusing the existing `promptRepository` and `promptCategoryRepository`
  instances.
- `src/app.ts`: add
  `app.put('/prompts/:id', validateRequestMiddleware(UpdatePromptSchema), updatePromptHandler);`.

**Migrations:** none — no schema change.

## 8. Dependency changes

None. `zod`, `express`, and `drizzle-orm` are already installed dependencies.

## 9. Assumptions and risks

**Assumptions**

1. This operation is a full replacement of title, prompt text, category, and
   description on every call — not a partial patch of only the fields
   supplied. This follows directly from spec Decision #1 (`description`'s
   field itself being required on every request). If wrong, this would
   instead need per-field "was this key supplied at all" tracking through
   the Zod schema, use case, and adapter — a materially different shape,
   requiring a return to the interview.
2. The route is `PUT /prompts/:id` (not `PATCH`), matching the full-replace
   semantics of Assumption 1 and standard REST convention for a
   whole-resource replacement. If wrong, only the HTTP method registered in
   `src/app.ts` changes — no handler/use-case/adapter impact.
3. `UpdatePromptUseCase` checks prompt existence before category existence
   (spec Decision #3, E1 precedence over E2). If wrong, only the order of
   the two `findById` calls and their guard clauses changes.
4. Handler/use-case/schema file names follow existing precedent exactly:
   `UpdatePromptHandler.ts` mirrors `CreatePromptHandler.ts`;
   `UpdatePromptUseCase.ts` mirrors `CreatePromptUseCase.ts`;
   `UpdatePromptSchema.ts` mirrors `CreatePromptSchema.ts`. If wrong, only
   renames are needed.
5. `updatePromptUseCase`'s constructor takes `promptRepository` first, then
   `promptCategoryRepository` — same order as `createPromptUseCase`
   (`005-create-prompt` plan.md §9 Assumption 5), for consistency. If wrong,
   a trivial signature reorder.
6. No uniqueness constraint on `title` is introduced or checked by this
   operation (mirrors `005-create-prompt` plan.md §9 Assumption 2). If
   wrong, a new V# and a repository-level check would be needed.

**Risks**

1. _(low likelihood, medium impact)_ A race between two concurrent update
   requests for the same prompt (last-write-wins, no optimistic
   concurrency/version check) could silently discard one caller's change.
   No such mechanism exists elsewhere in this codebase (`create`/`findAll`
   have the same absence of concurrency control). Mitigation: out of scope
   here; revisit if a future feature needs optimistic locking.
2. _(low likelihood, medium impact)_ A race between deleting a category and
   updating a prompt to reference it (category deleted between the
   category `findById` check and the `update` write) could violate the
   `prompt_category_id` foreign key at the database — identical to the
   already-accepted risk in `005-create-prompt` plan.md §9 Risk 2. No
   category-deletion feature exists yet, so this is currently unreachable.
   Mitigation: revisit if/when a delete-category feature is planned.
3. _(low likelihood, low impact)_ `update()`'s `.where(eq(prompts.id, id))`
   (no `::text` cast) relies on `UpdatePromptUseCase` always calling it with
   an id already confirmed to exist via `findById`. If a future caller ever
   invokes `update()` directly with an unconfirmed id, a malformed
   (non-UUID) id would throw at the database instead of failing gracefully.
   Mitigation: `update()` is not part of the port's public contract for
   arbitrary ids — only `UpdatePromptUseCase` is expected to call it, and
   this is tested at the adapter level with only well-formed ids (tasks.md).
4. _(low likelihood, low impact)_ `UpdatePrompt`'s conditional-spread
   `.set({...})` (§7) is written and tested only against the current
   always-fully-defined case (the HTTP layer requires every field on every
   request). A future genuine partial-update caller would exercise the "some
   fields undefined" path for the first time, untested until then.
   Mitigation: acceptable for now since no partial-update feature exists
   yet; revisit test coverage if one is planned.

## 10. Edge cases

- `title` or `prompt` missing entirely from the body → `UpdatePromptSchema`
  rejects with `Missing required value` (V1/V2, AC5/AC6).
- `title` or `prompt` present but an empty string → rejected by `.min(1)`
  (V1/V2, AC5/AC6).
- `category_id` missing entirely → rejected as `Missing required value` (V3,
  AC7).
- `category_id` present but not UUID-shaped (e.g. `"not-a-uuid"`) → rejected
  by `.uuid()` (V3, AC7).
- `description` key missing entirely from the body → rejected by
  `z.string().nullable()`'s required-field check (V4, AC4).
- `description` present as `null` → accepted; prompt updated to have no
  description (V4, AC2).
- `description` present as `""` → accepted; prompt updated to have an empty
  description, distinct from `null` (V4, AC3).
- `category_id` is UUID-shaped but matches no existing category, and the
  path `id` matches an existing prompt → `UpdatePromptUseCase.invoke()`
  throws `CategoryNotFoundError`; `PUT /prompts/:id` responds `400` with
  `{ error: "Category not found: <id>" }` (E2, AC9); no row is updated.
- Path `id` matches no existing prompt → `UpdatePromptUseCase.invoke()`
  throws `PromptNotFoundError` before ever calling
  `categoryRepository.findById()`; `PUT /prompts/:id` responds `404` with
  `{ error: "Prompt not found: <id>" }` (E1, AC10); no row is updated.
- Path `id` matches no existing prompt AND `category_id` also matches no
  existing category → only `PromptNotFoundError`/`404` is raised (E1 takes
  precedence over E2, AC11); the category is never even looked up.
- Several of V1/V2/V3/V4 at once (e.g. `title` and `description` both
  missing) → `UpdatePromptSchema`'s combined Zod object schema reports every
  failing field together in one `errors` array (AC8), per
  `004-request-validation-middleware`'s existing general behavior.
- Successful update → `createdAt` in the response is unchanged from the
  prompt's original value; `updatedAt` reflects the moment of this update,
  and is different from `createdAt` (unlike a fresh creation where the two
  are equal, `005-create-prompt` §10).

## 11. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| ----------------------------- | ---------------- |
| Field: id | `UpdatePromptQuery.id` (§4); `UpdatePromptSchema.params.id` (§6); `prompts.id` column (existing), used as the `WHERE` key in `update()` (§7) |
| Field: title | `UpdatePromptQuery.title` (§4); `UpdatePromptSchema.body.title` (§6); `prompts.title` column (existing) |
| Field: prompt | `UpdatePromptQuery.prompt` (§4); `UpdatePromptSchema.body.prompt` (§6); `prompts.prompt` column (existing) |
| Field: description | `UpdatePromptQuery.description?` (§4); `UpdatePrompt.description: string \| null` (§2); `UpdatePromptSchema.body.description` (§6); `prompts.description` nullable column (§7); AC2/AC3 |
| Field: category | `UpdatePromptQuery.categoryId` (§4); `UpdatePromptSchema.body.category_id` (§6); `PromptCategoryRepositoryInterface.findById` (§3, existing) |
| Field: category.id / category.name | `Prompt.category` (§2, existing); `PromptCategoryRepositoryInterface.findById` result (§3); route response body (§5) |
| Field: createdAt | preserved from `existingPrompt.createdAt` in `UpdatePromptUseCase.invoke` (§4), returned on the assembled `Prompt` only — never part of `UpdatePrompt` (§2), never written by `DrizzlePromptRepository.update` (§7) |
| Field: updatedAt | `UpdatePromptQuery.updatedAt`, generated by `UpdatePromptHandler` via `new Date()` (§5); required field on `UpdatePrompt` (§2); `prompts.updated_at` column (§7) |
| V1 (title required, non-empty) | `UpdatePromptSchema.body.title: z.string().min(1)` (§6); `400` mapping (§5); AC5 |
| V2 (prompt required, non-empty) | `UpdatePromptSchema.body.prompt: z.string().min(1)` (§6); `400` mapping (§5); AC6 |
| V3 (category required, valid identifier shape) | `UpdatePromptSchema.body.category_id: z.string().uuid()` (§6); `400` mapping (§5); AC7 |
| V4 (description field required, value may be absent) | `UpdatePromptSchema.body.description: z.string().nullable()` (§6); `400` mapping (§5); AC4/AC2/AC3 |
| E1 (prompt not found) | `PromptNotFoundError` (§2, existing); `UpdatePromptUseCase.invoke` throw (§4); `PUT /prompts/:id` `404` mapping in handler (§5) |
| E2 (category invalid) | `CategoryNotFoundError` (§2, existing); `UpdatePromptUseCase.invoke` throw (§4); `PUT /prompts/:id` `400` mapping in handler (§5) |
| AC1 | `UpdatePromptUseCase` (§4), passing an `UpdatePrompt` (§2) to `DrizzlePromptRepository.update(id, prompt)` + existing `findById`s (§7); `PUT /prompts/:id` `200` (§5) |
| AC2 | `UpdatePromptQuery.description?` (§4); `query.description ?? null` mapping into `UpdatePrompt.description` in `UpdatePromptUseCase.invoke` (§4); conditional-spread write in `DrizzlePromptRepository.update` (§7); `PUT /prompts/:id` response (§5) |
| AC3 | `UpdatePromptSchema.body.description: z.string().nullable()` accepting `""` (§6); pass-through in `UpdatePromptUseCase` (§4) |
| AC4 | `UpdatePromptSchema.body.description` required-field check (§6); `400` mapping (§5) |
| AC5 | `UpdatePromptSchema.body.title` (§6); `400` mapping (§5) |
| AC6 | `UpdatePromptSchema.body.prompt` (§6); `400` mapping (§5) |
| AC7 | `UpdatePromptSchema.body.category_id` (§6); `400` mapping (§5) |
| AC8 | `UpdatePromptSchema`'s combined `z.object` (§6), reported via the existing `validateRequestMiddleware` combined-`errors` behavior (`004-request-validation-middleware`) |
| AC9 | `CategoryNotFoundError` (§2); `UpdatePromptUseCase.invoke` throw (§4); `UpdatePromptHandler` `try/catch` → `400` (§5) |
| AC10 | `PromptNotFoundError` (§2); `UpdatePromptUseCase.invoke` throw (§4); `UpdatePromptHandler` `try/catch` → `404` (§5) |
| AC11 | `UpdatePromptUseCase.invoke`'s prompt-existence check ordered before the category-existence check (§4) |
| Decision #1 (description field required, value may be absent; full-replace shape) | §2 `Prompt` (unchanged); §4 `UpdatePromptUseCase` assembly; §6 `UpdatePromptSchema.body.description`; §9 Assumption 1 |
| Decision #2 (empty description is a valid, distinct value) | §6 `UpdatePromptSchema.body.description: z.string().nullable()` (no `.min(1)`); AC3 |
| Decision #3 (prompt-not-found precedence over category-invalid) | §4 `UpdatePromptUseCase.invoke` check ordering; §9 Assumption 3; AC11 |
