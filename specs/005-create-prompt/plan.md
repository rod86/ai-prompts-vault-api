# Plan: Create prompt

Spec: specs/005-create-prompt/spec.md
Status: READY FOR REVIEW

## 1. Bounded context

Owning context: **prompt** (`src/logic/prompt/`), the same context that
already owns `Prompt` and `PromptCategory` (`specs/001-list-categories/`,
`specs/002-list-prompts/`, `specs/003-get-prompt/`). This feature creates a new
`Prompt`, validating it against an existing `PromptCategory` in the same
context; no new context is created.

Cross-context interaction: none new. The use case reads `PromptCategory` via
`PromptCategoryRepositoryInterface` (existing port, extended, §3) and writes
`Prompt` via `PromptRepositoryInterface` (existing port, extended, §3) — both
already owned by this context.

## 2. Entities and value objects

**`Prompt`** (existing, unchanged) — `src/logic/prompt/domain/Prompt.ts`. The
entity created by this feature; reused exactly as defined for
`003-get-prompt`, since spec §2 defines the identical field set for the
returned prompt.

**`PromptCategory`** (existing, unchanged) —
`src/logic/prompt/domain/PromptCategory.ts`. Looked up (not created) by this
feature, to validate the supplied category reference (spec V3/E1) and to
supply `category.name` in the assembled response (spec §2).

**`CategoryNotFoundError`** (new) —
`src/logic/prompt/domain/errors/CategoryNotFoundError.ts`

```ts
export class CategoryNotFoundError extends Error {
    constructor(id: string) {
        super(`Category not found: ${id}`);
        this.name = 'CategoryNotFoundError';
    }
}
```

- A domain-specific error class, per `coding-style`'s "throw domain-specific
  error classes, never raw strings or bare `Error`" rule, mirroring the
  existing `PromptNotFoundError` (`003-get-prompt` plan.md §2). Carries the
  supplied category id in its message for diagnosability.
- Satisfies spec §4 E1 / AC6.

## 3. Ports

**`PromptCategoryRepositoryInterface`** (existing, extended) —
`src/logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.ts`

```ts
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';

export default interface PromptCategoryRepositoryInterface {
    findAll(): Promise<PromptCategory[]>;
    findById(id: string): Promise<PromptCategory | undefined>;
}
```

- `findById()` is new: returns the matching category, or `undefined` when no
  category matches — modeling "missing" as `T | undefined` per
  `coding-style`, not `null`, not a thrown error at the port level (the error
  is raised by the use case, §4), mirroring `PromptRepositoryInterface.findById`
  (`003-get-prompt` plan.md §3).
- Compared for an exact match only; a value matching no row yields
  `undefined` (spec E1/AC6), never a rejected call at the port level.

**`PromptRepositoryInterface`** (existing, extended) —
`src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`

```ts
import { type Prompt } from '@logic/prompt/domain/Prompt.js';

export interface PromptFilter {
    categoryId?: string;
}

export default interface PromptRepositoryInterface {
    findAll(filter?: PromptFilter): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt | undefined>;
    create(prompt: Prompt): Promise<void>;
}
```

- `create()` is new: persists a fully-assembled `Prompt` domain entity;
  returns nothing (per `hexagonal-architecture`'s "omit `Response` only when
  the use case returns a domain entity or nothing (`void`) directly" — here
  the port method itself returns `void`, and the use case returns the entity
  it already built in-memory, §4).

## 4. Use cases

**`CreatePromptUseCase`** (new) —
`src/logic/prompt/application/CreatePromptUseCase.ts`

- Input: `CreatePromptQuery`.
- Output: `Promise<Prompt>` (returns the domain entity directly — no
  `Response` type, per `hexagonal-architecture`'s convention, matching
  `GetPromptUseCase`).
- Ports called: `PromptCategoryRepositoryInterface.findById()`,
  `PromptRepositoryInterface.create()`.
- AC satisfied: AC1 (assembles and persists the full prompt), AC2
  (pass-through of an absent `description`), AC6 (throws
  `CategoryNotFoundError` when the category repository returns `undefined`,
  without calling `create`).

```ts
import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';

export interface CreatePromptQuery {
    id: string;
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class CreatePromptUseCase {
    constructor(
        private readonly promptRepository: PromptRepositoryInterface,
        private readonly categoryRepository: PromptCategoryRepositoryInterface,
    ) {}

    public async invoke(query: CreatePromptQuery): Promise<Prompt> {
        const category = await this.categoryRepository.findById(query.categoryId);

        if (!category) {
            throw new CategoryNotFoundError(query.categoryId);
        }

        const prompt: Prompt = {
            id: query.id,
            category,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
        };

        await this.promptRepository.create(prompt);

        return prompt;
    }
}
```

- Per `coding-style`'s "domain functions are pure — no I/O, clock, or
  randomness; inject those" rule, `id`, `createdAt`, and `updatedAt` are
  generated by the caller (`CreatePromptHandler`, §5) and passed in on the
  query — the use case itself never calls `randomUUID()` or `new Date()`.
  `createdAt === updatedAt` at creation time is the caller's responsibility,
  not enforced here.
- No re-fetch after `create()`: the returned `Prompt` is assembled in-memory
  from the query fields plus the already-looked-up `category`, satisfying
  spec AC1 without a second database round trip.

## 5. Routes

**`POST /prompts`**

- Request body: `{ title: string, prompt: string, category_id: string,
description?: string }` (snake_case wire field `category_id`, mapped to the
  use case's `categoryId`).
- Response `201`: JSON object
  `{ id, category: { id, name }, title, prompt, description, createdAt, updatedAt }`
  (spec AC1) — the same shape `GetPromptHandler` returns for an existing
  prompt; `description` is omitted when none was supplied (spec AC2).
- Response `400` (V1/V2/V3 — malformed request): body
  `{ message: 'The request was invalid.', errors: [{ field, error }] }`, via
  the existing shared `validateRequestMiddleware` (`004-request-validation-middleware`) —
  covers a missing/blank `title` (V1), missing/blank `prompt` (V2), and a
  missing or non-UUID-shaped `category_id` (V3), including several at once
  (spec AC7).
- Response `400` (E1 — category invalid): body `{ error: string }` (e.g.
  `{ "error": "Category not found: <id>" }`) — triggered when `category_id`
  is UUID-shaped but matches no existing category (spec AC6). Deliberately
  `400`, not `404`: this is a business-rule check on a body field of a write
  operation, not a missing URL-addressed resource (contrast `GET /prompts/:id`'s
  `404`, `003-get-prompt` plan.md §5).
- Handler: `src/handlers/CreatePromptHandler.ts` (default export, mirrors
  `GetPromptHandler.ts`'s structure), reaching business logic only via
  `src/logic/prompt/services.ts`.
- Error mapping: handled locally inside `CreatePromptHandler.ts` via
  `try/catch` around `createPromptUseCase.invoke(...)` — catches
  `CategoryNotFoundError` specifically and responds `400` with its message;
  any other thrown error is re-thrown (not swallowed), matching
  `coding-style`'s "no swallowed catches" rule and the same local-handling
  precedent as `GetPromptHandler.ts` (no shared/global error-handling
  middleware exists in this codebase, per `004-request-validation-middleware`
  plan.md §3).

## 6. Validation schemas

**`CreatePromptSchema`** (new, Zod) — `src/schemas/CreatePromptSchema.ts`

```ts
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    body: z.object({
        title: z.string().min(1),
        prompt: z.string().min(1),
        category_id: z.string().uuid(),
        description: z.string().optional(),
    }),
} satisfies RequestSchema;
```

- `title: z.string().min(1)` traces to V1 (required, non-empty).
- `prompt: z.string().min(1)` traces to V2 (required, non-empty).
- `category_id: z.string().uuid()` traces to V3 (required, must be shaped
  like a valid category identifier) — the format check only; a well-formed
  but non-existent id is not caught here (see E1, §4).
- `description: z.string().optional()` — spec §3 defines no rule for
  `description`; present only to satisfy `coding-style`'s "validate all
  external input with Zod at the HTTP boundary" rule.
- Lives under `src/schemas/`, colocated with the other route schemas
  (`GetPromptSchema.ts`, `GetPromptsSchema.ts`), per the current repository
  layout (moved there from the originally-planned `src/handlers/schemas/` in
  `004-request-validation-middleware`'s follow-up reorganization).
- Consumed by `validateRequestMiddleware(CreatePromptSchema)` (§5); the
  handler reads the parsed value from `req.parsedRequest?.body`, never
  calling `.parse()` itself, mirroring `GetPromptHandler.ts` /
  `GetPromptsHandler.ts`.

## 7. Persistence adapter

**Schema:** no change — `src/logic/prompt/infrastructure/database/schema.ts`
already defines every column this feature needs (`prompts.id`,
`.promptCategoryId`, `.title`, `.prompt`, `.description`, `.createdAt`,
`.updatedAt`).

**`DrizzlePromptCategoryRepository`** (existing file, extended) —
`src/logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts`
adds `findById`:

```ts
public async findById(id: string): Promise<PromptCategory | undefined> {
    const rows = await this.db
        .select({ id: promptCategories.id, name: promptCategories.name })
        .from(promptCategories)
        .where(eq(sql`${promptCategories.id}::text`, id))
        .limit(1);

    return rows[0];
}
```

- `eq(sql`${promptCategories.id}::text`, id)` mirrors the existing `::text`
  cast pattern (`DrizzlePromptRepository.findById`, `003-get-prompt` plan.md
  §7): `promptCategories.id` is a `uuid` column, so a malformed/non-UUID id
  would otherwise throw an "invalid input syntax for uuid" error at the
  database; casting to `::text` makes a malformed id simply match no row,
  falling through to `undefined`.
- Note: `CreatePromptSchema`'s `category_id: z.string().uuid()` (§6) already
  rejects a non-UUID-shaped value before this method is ever called in the
  `POST /prompts` flow; the `::text` cast is kept for consistency with the
  existing repository pattern and to keep the method safe to call with any
  string (e.g. from a future caller or a unit/integration test that bypasses
  the HTTP layer).

**`DrizzlePromptRepository`** (existing file, extended) —
`src/logic/prompt/infrastructure/database/DrizzlePromptRepository.ts` adds
`create`:

```ts
public async create(prompt: Prompt): Promise<void> {
    await this.db.insert(prompts).values({
        id: prompt.id,
        promptCategoryId: prompt.category.id,
        title: prompt.title,
        prompt: prompt.prompt,
        description: prompt.description ?? null,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
    });
}
```

- `description: prompt.description ?? null` maps an absent domain value to
  the nullable `description` column (spec AC2), the inverse of `findAll`'s /
  `findById`'s `description: row.description ?? undefined` mapping.
- `prompt.category.name` is not persisted (no such column) — only
  `prompt.category.id` is written, consistent with `prompt_category_id` being
  the sole FK column on `prompts` (`database-modeling` skill's FK column
  convention).

**Wiring:**

- `src/logic/prompt/services.ts`: add
  `export const createPromptUseCase = new CreatePromptUseCase(promptRepository, promptCategoryRepository);`,
  reusing the existing `promptRepository` and `promptCategoryRepository`
  instances.
- `src/app.ts`: add
  `app.post('/prompts', validateRequestMiddleware(CreatePromptSchema), createPromptHandler);`.

**Migrations:** none — no schema change.

## 8. Dependency changes

None. `zod`, `express`, and `drizzle-orm` are already installed dependencies.

## 9. Assumptions and risks

**Assumptions**

1. `description` has no non-empty/blank constraint (unlike `title`/`prompt`):
   an empty string is accepted as a valid (if unusual) description, since
   spec §3 defines no rule for it. If wrong, add a V# and a `.min(1)`
   constraint to `CreatePromptSchema`.
2. Two prompts may share the same `title` — no uniqueness constraint is
   enforced by this feature. If wrong, a new V# and a repository-level check
   (or a database unique constraint + migration) would be needed; out of
   scope here since the story and given decisions do not ask for it.
3. `CategoryNotFoundError`'s message format (`` `Category not found: ${id}` ``)
   mirrors the existing `PromptNotFoundError` convention exactly. If wrong,
   only the error class's message string changes — no structural impact.
4. Handler/use-case/schema file names follow existing precedent exactly:
   `CreatePromptHandler.ts` mirrors `GetPromptHandler.ts`;
   `CreatePromptUseCase.ts` mirrors `GetPromptUseCase.ts`;
   `CreatePromptSchema.ts` mirrors `GetPromptSchema.ts`. If wrong, only
   renames are needed.
5. `createPromptUseCase`'s constructor takes `promptRepository` first, then
   `promptCategoryRepository` — an arbitrary but fixed argument order,
   consistent within this feature. If wrong, a trivial signature reorder.

**Risks**

1. _(low likelihood, low impact)_ `CreatePromptSchema`'s `category_id:
z.string().uuid()` check already rejects any non-UUID-shaped value at the
   HTTP boundary, so `DrizzlePromptCategoryRepository.findById`'s `::text`
   cast path (§7) is only exercised by a well-formed-but-non-existent id in
   the actual `POST /prompts` flow; its "malformed id" behavior is only
   reachable from a direct repository-level test, not from the route.
   Mitigation: still test it directly (tasks.md), since the port method must
   remain safe to call with any string.
2. _(low likelihood, medium impact)_ A race between two concurrent requests
   creating prompts against the same category is not a concern (no
   uniqueness or count constraint depends on it); a race between deleting a
   category and creating a prompt against it (category deleted between the
   `findById` check and the `create` insert) could violate the `prompt_category_id`
   foreign key at the database — no category-deletion feature exists yet, so
   this is currently unreachable. Mitigation: revisit if/when a
   delete-category feature is planned.

## 10. Edge cases

- `title` or `prompt` missing entirely from the body → `CreatePromptSchema`
  rejects with `Required` (V1/V2, AC3/AC4).
- `title` or `prompt` present but an empty string → rejected by `.min(1)`
  (V1/V2, AC3/AC4).
- `category_id` missing entirely → rejected as `Required` (V3, AC5).
- `category_id` present but not UUID-shaped (e.g. `"not-a-uuid"`) → rejected
  by `.uuid()` (V3, AC5).
- `category_id` is UUID-shaped but matches no existing category →
  `CreatePromptUseCase.invoke()` throws `CategoryNotFoundError`; `POST /prompts`
  responds `400` with `{ error: "Category not found: <id>" }` (E1, AC6); no
  row is inserted.
- Several of the above at once (e.g. `title` and `prompt` both missing) →
  `CreatePromptSchema`'s combined Zod object schema reports every failing
  field together in one `errors` array (V1/V2/V3 combined, AC7), per
  `004-request-validation-middleware`'s existing general behavior.
- `description` omitted → prompt created with `description` absent in the
  response (AC2), stored as `NULL`, never as an empty string.
- `description` supplied → prompt created and returned with that value
  (AC1).
- Successful creation → `createdAt` and `updatedAt` are equal in the
  response (assigned by `CreatePromptHandler` from the same `Date`
  instance/value, §5 Assumption none — this is the caller's responsibility
  per §4).

## 11. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| ----------------------------- | ---------------- |
| Field: title | `CreatePromptQuery.title` (§4); `CreatePromptSchema.body.title` (§6); `prompts.title` column (existing) |
| Field: prompt | `CreatePromptQuery.prompt` (§4); `CreatePromptSchema.body.prompt` (§6); `prompts.prompt` column (existing) |
| Field: description | `CreatePromptQuery.description?` (§4); `CreatePromptSchema.body.description` (§6); `prompts.description` nullable column (§7); AC2 |
| Field: category | `CreatePromptQuery.categoryId` (§4); `CreatePromptSchema.body.category_id` (§6); `PromptCategoryRepositoryInterface.findById` (§3, §7) |
| Field: id | `CreatePromptQuery.id`, generated by `CreatePromptHandler` via `randomUUID()` (§5); `Prompt.id` (§2); `prompts.id` column (existing) |
| Field: category.id / category.name | `Prompt.category` (§2, existing); `PromptCategoryRepositoryInterface.findById` result (§3, §7); route response body (§5) |
| Field: createdAt / updatedAt | `CreatePromptQuery.createdAt`/`.updatedAt`, generated by `CreatePromptHandler` via `new Date()` (§5); `prompts.created_at`/`.updated_at` columns (existing) |
| V1 (title required, non-empty) | `CreatePromptSchema.body.title: z.string().min(1)` (§6); `400` mapping (§5); AC3 |
| V2 (prompt required, non-empty) | `CreatePromptSchema.body.prompt: z.string().min(1)` (§6); `400` mapping (§5); AC4 |
| V3 (category required, valid identifier shape) | `CreatePromptSchema.body.category_id: z.string().uuid()` (§6); `400` mapping (§5); AC5 |
| E1 (category invalid) | `CategoryNotFoundError` (§2); `CreatePromptUseCase.invoke` throw (§4); `POST /prompts` `400` mapping in handler (§5) |
| AC1 | `CreatePromptUseCase` (§4); `DrizzlePromptRepository.create` + `DrizzlePromptCategoryRepository.findById` (§7); `POST /prompts` `201` (§5) |
| AC2 | `CreatePromptQuery.description?` (§4); `description ?? null` mapping (§7); `POST /prompts` response (§5) |
| AC3 | `CreatePromptSchema.body.title` (§6); `400` mapping (§5) |
| AC4 | `CreatePromptSchema.body.prompt` (§6); `400` mapping (§5) |
| AC5 | `CreatePromptSchema.body.category_id` (§6); `400` mapping (§5) |
| AC6 | `CategoryNotFoundError` (§2); `CreatePromptUseCase.invoke` throw (§4); `CreatePromptHandler` `try/catch` → `400` (§5) |
| AC7 | `CreatePromptSchema`'s combined `z.object` (§6), reported via the existing `validateRequestMiddleware` combined-`errors` behavior (`004-request-validation-middleware`) |
| Decision #1 (reuse 003's field set; mark system-assigned fields) | §2 `Prompt` (unchanged); §4 `CreatePromptUseCase` assembly |
| Decision #3 (shape vs existence are distinct problems) | §3 port contracts; §4 use-case throw; §5/§6 V3 vs E1 split |
| Decision #4 (combined errors reported together) | §6 `CreatePromptSchema` single combined `z.object`; existing `validateRequestMiddleware` behavior |
| Decision #5 (strict category validation, diverging from list-time opaque filter) | §6 `category_id: z.string().uuid()`; §3/§4 E1 existence check |
