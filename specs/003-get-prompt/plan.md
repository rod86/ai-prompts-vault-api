# Plan: Get prompt by id

Spec: specs/003-get-prompt/spec.md

## 1. Bounded context

Owning context: **prompt** (`src/logic/prompt/`), the same context that
already owns `Prompt` and `PromptCategory` (`specs/001-list-categories/`,
`specs/002-list-prompts/`). This feature reads a single existing prompt by
id; no new context is created.

Cross-context interaction: none new. Reads `PromptCategory` data via the
same database join pattern already used by `findAll` (see §7); does not
call `PromptCategoryRepositoryInterface` directly.

## 2. Entities and value objects

**`Prompt`** (existing, unchanged) — `src/logic/prompt/domain/Prompt.ts`.
The single domain entity for this feature; reused exactly as defined for
`002-list-prompts`, since spec §2 defines the identical field set.

**`PromptNotFoundError`** (new) —
`src/logic/prompt/domain/errors/PromptNotFoundError.ts`

```ts
export class PromptNotFoundError extends Error {
    constructor(id: string) {
        super(`Prompt not found: ${id}`);
        this.name = 'PromptNotFoundError';
    }
}
```

- A domain-specific error class, per `coding-style`'s "throw domain-specific
  error classes, never raw strings or bare `Error`" rule. Carries the id
  in its message for diagnosability.
- Satisfies spec §4 E1 / AC3.

## 3. Ports

**`PromptRepositoryInterface`** (existing, extended) —
`src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`

```ts
import { type Prompt } from '@logic/prompt/domain/Prompt';

export interface PromptFilter {
    categoryId?: string;
}

export default interface PromptRepositoryInterface {
    findAll(filter?: PromptFilter): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt | undefined>;
}
```

- `findById()` is new: returns the matching prompt (already joined with
  its category, per §7), or `undefined` when no prompt matches — modeling
  "missing" as `T | undefined` per `coding-style`, not `null` and not a
  thrown error at the port level (the error is raised in the use case,
  §4).
- `id` is compared for an exact match only (spec §3); a value matching no
  row simply yields `undefined` (spec AC3), never a rejected call.

## 4. Use cases

**`GetPromptUseCase`** (new) —
`src/logic/prompt/application/GetPromptUseCase.ts`

- Input: `id: string`.
- Output: `Promise<Prompt>`.
- Ports called: `PromptRepositoryInterface.findById()`.
- AC satisfied: AC1, AC2 (pass-through of the adapter's fully-shaped
  result), AC3 (throws `PromptNotFoundError` when the repository returns
  `undefined`).

```ts
import { type Prompt } from '@logic/prompt/domain/Prompt';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface';

export class GetPromptUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(id: string): Promise<Prompt> {
        const prompt = await this.repository.findById(id);

        if (!prompt) {
            throw new PromptNotFoundError(id);
        }

        return prompt;
    }
}
```

## 5. Routes

**`GET /prompts/:id`**

- Request: path parameter `id` (plain string, no query, no body).
- Response `200`: JSON object
  `{ id, category: { id, name }, title, prompt, description, createdAt, updatedAt }`
  (spec AC1); `description` is omitted when the prompt has none (spec
  AC2).
- Response `404`: E1 — supplied id matches no prompt (spec AC3). Body:
  `{ error: string }` (e.g. `{ "error": "Prompt not found: <id>" }`).
- Handler: `src/handlers/GetPromptHandler.ts` (default export, mirrors
  `src/handlers/GetPromptsHandler.ts` naming, singular for a
  single-resource fetch), reaching business logic only via
  `src/logic/prompt/services.ts`.
- Error mapping: handled locally inside `GetPromptHandler.ts` via
  `try/catch` around `getPromptUseCase.invoke(id)` — catches
  `PromptNotFoundError` specifically and responds `404` with its message;
  any other thrown error is re-thrown (not swallowed), matching
  `coding-style`'s "no swallowed catches" rule. Per explicit user
  direction, this feature does **not** introduce a shared/global
  error-handling middleware (see §9 Assumption 3) — that stays a
  per-handler concern here.

## 6. Validation schemas

**`GetPromptParamsSchema`** (new, Zod) —
`src/handlers/schemas/GetPromptParamsSchema.ts`

```ts
import { z } from 'zod';

export const GetPromptParamsSchema = z.object({
    id: z.string(),
});
```

- Spec §3 defines no V# (no id value is "invalid" for this operation) —
  this schema exists solely to satisfy `coding-style`'s "validate all
  external input with Zod at the HTTP boundary" rule, guarding against a
  structurally unexpected `req.params.id` reaching the use case as
  anything other than a plain string.
- Lives under `src/handlers/schemas/`, colocated with its handler
  (`GetPromptHandler.ts`), mirroring `GetPromptsQuerySchema`'s placement
  precedent from `002-list-prompts`.

## 7. Persistence adapter

**Schema:** no change — `src/logic/prompt/infrastructure/database/schema.ts`
already defines every column this feature needs (`prompts.id`, `.title`,
`.prompt`, `.description`, `.createdAt`, `.updatedAt`,
`.promptCategoryId` joined to `promptCategories`).

**Repository adapter** (existing file, extended) —
`src/logic/prompt/infrastructure/database/DrizzlePromptRepository.ts`
adds `findById`:

```ts
public async findById(id: string): Promise<Prompt | undefined> {
    const rows = await this.db
        .select({
            id: prompts.id,
            title: prompts.title,
            prompt: prompts.prompt,
            description: prompts.description,
            createdAt: prompts.createdAt,
            updatedAt: prompts.updatedAt,
            categoryId: promptCategories.id,
            categoryName: promptCategories.name,
        })
        .from(prompts)
        .innerJoin(promptCategories, eq(prompts.promptCategoryId, promptCategories.id))
        .where(eq(sql`${prompts.id}::text`, id))
        .limit(1);

    const row = rows[0];

    if (!row) {
        return undefined;
    }

    return {
        id: row.id,
        category: { id: row.categoryId, name: row.categoryName },
        title: row.title,
        prompt: row.prompt,
        description: row.description ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
```

- Joins `prompts` to `prompt_categories` exactly like `findAll`, so the
  nested `category` reference is built in one query.
- `eq(sql`${prompts.id}::text`, id)` mirrors `findAll`'s existing
  `promptCategoryId` text-cast: `prompts.id` is a `uuid` column, so a
  malformed/non-UUID id would otherwise throw an "invalid input syntax for
  uuid" error at the database. Casting to `::text` makes a malformed id
  simply match no row — falling through to `undefined` (spec §3, AC3),
  never a separate validation error (see §9 Assumption 1).
- `description: row.description ?? undefined` maps a `NULL` column to an
  absent (`undefined`) domain value (spec AC2), identical to `findAll`.
- Domain↔storage mapping: identical to `findAll` (§ from `002-list-prompts`
  plan.md §7), scoped to a single row.

**Wiring:**

- `src/logic/prompt/services.ts`: add
  `export const getPromptUseCase = new GetPromptUseCase(promptRepository);`,
  reusing the existing `promptRepository` instance.
- `src/app.ts`: add `app.get('/prompts/:id', getPromptHandler);`. No
  middleware registration (per §9 Assumption 3).

**Migrations:** none — no schema change.

## 8. Dependency changes

None. `zod` is already an installed dependency (added for
`002-list-prompts`).

## 9. Assumptions and risks

**Assumptions**

1. A malformed/non-UUID id is treated identically to a well-formed but
   non-matching id: both simply return "not found" (E1/AC3), via the same
   `::text` cast approach `findAll` already uses for `categoryId`. If
   wrong, only the `where` clause's cast changes; no impact on AC1/AC2.
2. The response shape for `GET /prompts/:id` is identical to a single item
   of `GET /prompts`'s array response (no new DTO). If wrong, only the
   handler's response mapping changes.
3. Per explicit user direction, this feature does not introduce a shared
   Express error-handling middleware, even though `coding-style` generally
   recommends mapping domain errors to HTTP status "in one place." Instead,
   `GetPromptHandler.ts` catches `PromptNotFoundError` locally via
   `try/catch` and responds `404` itself. This is a deliberate, scoped
   deviation for this single-error-case feature; if a second error case is
   introduced by a future feature, revisit introducing shared middleware
   then. If wrong, only `GetPromptHandler.ts`'s error handling moves into a
   new middleware file — no port/use-case/adapter change.
4. Handler and use-case file names follow the existing precedent exactly:
   `GetPromptHandler.ts` (singular) mirrors `GetPromptsHandler.ts`
   (plural, list); `GetPromptUseCase.ts` mirrors `ListPromptsUseCase.ts`.
   If wrong, only renames are needed.

**Risks**

1. _(low likelihood, low impact)_ `findById`'s inner join silently returns
   `undefined` for a prompt whose `prompt_category_id` no longer matches a
   row in `prompt_categories` (an orphaned FK), identical to the existing
   risk already accepted in `findAll` (`002-list-prompts` plan.md §9 Risk
   3). Cannot occur under the stated FK constraint invariant.
2. _(low likelihood, medium impact)_ Handling `PromptNotFoundError` locally
   in the handler (§9 Assumption 3) means any future error case introduced
   elsewhere in the `prompt` context will need its own local handling too,
   until a shared middleware is introduced — inconsistent error-response
   shapes could emerge across handlers in the meantime. Mitigation: keep
   the `{ error: string }` body shape consistent by convention even
   without shared code, so a future middleware extraction is a pure
   refactor.

## 10. Edge cases

- Id belongs to no existing prompt (never created, or otherwise absent) →
  `findById()` returns `undefined`; `GetPromptUseCase.invoke()` throws
  `PromptNotFoundError`; `GET /prompts/:id` responds `404` (AC3).
- Id is not UUID-shaped (e.g. an arbitrary string) → no format check is
  applied (spec §3); compared via `::text` cast, naturally returns
  `undefined`/`404`, identical to any other non-matching id (§9 Assumption
  1).
- Prompt has no description → included in the response with `description`
  absent (AC2), not `null`, not an error.
- Prompt exists and has a description → full response including
  `description` (AC1).

## 11. Traceability

| Spec item | Plan element(s) |
| --------- | ---------------- |
| Field: id | `Prompt.id` (§2, existing); route response body (§5) |
| Field: category.id / category.name | `Prompt.category` (§2, existing); join to `prompt_categories` in `DrizzlePromptRepository.findById` (§7); route response body (§5) |
| Field: title | `Prompt.title` (§2, existing); `prompts.title` column (existing) |
| Field: prompt | `Prompt.prompt` (§2, existing); `prompts.prompt` column (existing) |
| Field: description | `Prompt.description?` (§2, existing); `prompts.description` nullable column (existing); AC2 |
| Field: createdAt | `Prompt.createdAt` (§2, existing); `prompts.created_at` column (existing) |
| Field: updatedAt | `Prompt.updatedAt` (§2, existing); `prompts.updated_at` column (existing) |
| §3 (no validation rules; opaque id) | §6 `GetPromptParamsSchema` (boundary-only, no V# traced); §3 port contract |
| E1 (prompt not found) | `PromptNotFoundError` (§2); `GetPromptUseCase.invoke` throw (§4); `GET /prompts/:id` `404` mapping in handler (§5) |
| AC1 | `GetPromptUseCase` (§4); `DrizzlePromptRepository.findById` (§7); `GET /prompts/:id` `200` (§5) |
| AC2 | `Prompt.description?` (§2); `description ?? undefined` mapping (§7); `GET /prompts/:id` response (§5) |
| AC3 | `PromptNotFoundError` (§2); `GetPromptUseCase.invoke` throw (§4); `GetPromptHandler` `try/catch` → `404` (§5) |
| Decision #1 (reuse 002's field set) | §2 `Prompt` (unchanged); §7 adapter mapping |
| Decision #2 (not-found is an error, not empty success) | §2 `PromptNotFoundError`; §4 use-case throw; §5 `404` mapping |
