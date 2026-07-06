# Plan: Delete prompt

Spec: specs/007-delete-prompt/spec.md

## 1. Bounded context

Owning context: **prompt** (`src/logic/prompt/`), the same context that
already owns `Prompt` and `PromptCategory` (`specs/001-list-categories/`,
`specs/002-list-prompts/`, `specs/003-get-prompt/`, `specs/005-create-prompt/`,
`specs/006-update-prompt/`). This feature removes an existing `Prompt`; no
new context is created and no cross-context interaction is introduced.

## 2. Entities and value objects

**`Prompt`** (existing, unchanged) — `src/logic/prompt/domain/Prompt.ts`. The
entity removed by this feature. No new fields; this feature reads only its
`id` (via the existing `findById`) to confirm existence before removing it.

**`PromptNotFoundError`** (existing, reused, unchanged) —
`src/logic/prompt/domain/errors/PromptNotFoundError.ts` (introduced by
`003-get-prompt`, already reused by `006-update-prompt`). Thrown when the
supplied id matches no existing prompt. Satisfies spec §4 E1 / AC4 / AC5.

No new domain error classes or value objects are needed.

## 3. Ports

**`PromptRepositoryInterface`** (existing, extended) —
`src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts`

```ts
import { type Prompt, type PromptFilter, type UpdatePrompt } from '@logic/prompt/domain/Prompt.js';

export default interface PromptRepositoryInterface {
    findAll(filter?: PromptFilter): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt | undefined>;
    create(prompt: Prompt): Promise<void>;
    update(id: string, prompt: UpdatePrompt): Promise<void>;
    delete(id: string): Promise<void>;
}
```

- `delete()` is new: takes the raw `id` (mirroring `findById(id: string)`'s
  and `update(id: string, ...)`'s convention of addressing a row by a raw id
  parameter), returns nothing (per `hexagonal-architecture`'s "omit
  `Response` only when the use case returns a domain entity or nothing
  (`void`) directly" — mirrored at the port level here too, consistent with
  `update()`'s existing `Promise<void>`).
- `findById()` (existing, reused unchanged) is used by the use case to check
  the prompt exists before removing it (spec E1/AC4/AC5) — same
  existence-check-before-mutation pattern as `UpdatePromptUseCase`
  (`006-update-prompt` plan.md §4).

No other port changes. `PromptCategoryRepositoryInterface` is untouched —
this feature never looks up or validates a category.

## 4. Use cases

**`DeletePromptUseCase`** (new) —
`src/logic/prompt/application/DeletePromptUseCase.ts`

- Input: `DeletePromptQuery`.
- Output: none (`Promise<void>`) — no `Response` type, per
  `hexagonal-architecture`'s convention (mirrors the "returns nothing"
  case, distinct from `GetPromptUseCase`/`UpdatePromptUseCase`, which return
  the entity).
- Ports called: `PromptRepositoryInterface.findById()`,
  `PromptRepositoryInterface.delete()`.
- AC satisfied: AC1 (removes the prompt via `delete()` once existence is
  confirmed), AC2/AC3 (a removed row can never again be returned by
  `findById()`/`findAll()`, satisfied by `delete()` being a real row removal,
  not a flag), AC4/AC5 (throws `PromptNotFoundError` when `findById()`
  returns `undefined`, without calling `delete()`).

```ts
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';

export interface DeletePromptQuery {
    id: string;
}

export class DeletePromptUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: DeletePromptQuery): Promise<void> {
        const prompt = await this.repository.findById(query.id);

        if (!prompt) {
            throw new PromptNotFoundError(query.id);
        }

        await this.repository.delete(query.id);
    }
}
```

- `findById()` is reused rather than inspecting `delete()`'s own affected-row
  count, keeping not-found detection identical in shape to
  `GetPromptUseCase`/`UpdatePromptUseCase` (a single, consistent pattern
  across the context for "does this id exist").

## 5. Routes

**`DELETE /prompts/:id`**

- Request: path parameter `id` (plain string), no body.
- Response `204` (spec AC1): empty body — no confirmation payload, per spec
  Decision #1. The removal having succeeded (status alone) is the
  confirmation.
- Response `404` (E1 — prompt not found): body `{ error: string }` (e.g.
  `{ "error": "Prompt not found: <id>" }`) — triggered when the path `id`
  matches no existing prompt (spec AC4/AC5). Mirrors `GET /prompts/:id`'s
  and `PUT /prompts/:id`'s `404` (`003-get-prompt` plan.md §5,
  `006-update-prompt` plan.md §5).
- Handler: `src/handlers/DeletePromptHandler.ts` (default export, mirrors
  `GetPromptHandler.ts`'s structure), reaching business logic only via
  `src/logic/prompt/services.ts`.
- Error mapping: handled locally inside `DeletePromptHandler.ts` via
  `try/catch` around `deletePromptUseCase.invoke(...)` — catches
  `PromptNotFoundError` specifically and responds `404` with its message;
  any other thrown error is re-thrown (not swallowed), matching
  `coding-style`'s "no swallowed catches" rule and the same local-handling
  precedent as `GetPromptHandler.ts`/`UpdatePromptHandler.ts` (no
  shared/global error-handling middleware exists in this codebase, per
  `004-request-validation-middleware` plan.md §3).

## 6. Validation schemas

**`DeletePromptSchema`** (new, Zod) — `src/schemas/DeletePromptSchema.ts`

```ts
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    params: z.object({
        id: z.uuid({
            error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value'),
        }),
    }),
} satisfies RequestSchema;
```

- `params.id: z.uuid(...)` — the path id is validated as a real UUID string at
  the HTTP boundary, mirroring the `z.uuid({ error: ... })` pattern already
  used for `category_id` in `CreatePromptSchema`/`UpdatePromptSchema`. The
  `error` callback returns `'Missing required value'` for `invalid_type`
  (id absent) and `'Invalid UUID value'` for a malformed shape; the
  `invalid_type` branch is effectively unreachable for a path segment (Express
  will not match `/prompts/:id` without one) and is present only for parity
  with the sibling schemas.
- A malformed id (e.g. `not-a-uuid`) is therefore rejected by
  `validateRequestMiddleware` with `400 { errors: [{ field: 'params.id',
  error: 'Invalid UUID value' }] }` before the handler/use case run; a
  well-formed-but-absent uuid still passes validation and yields the E1 `404`.
- A `Request Validation` test block **is** planned for the handler (T8), since
  `z.uuid()` can now fail — mirroring `CreatePromptHandler.test.ts` /
  `UpdatePromptHandler.test.ts`'s non-uuid `category_id` cases.
- The same `params.id` tightening is applied to
  `src/schemas/UpdatePromptSchema.ts` (spec 006 code) under this spec (T9), per
  user instruction; spec 006's own documents are left untouched. No existing
  `UpdatePromptHandler` test regresses — every path id there is a fixture id or
  `faker.string.uuid()`, both uuid-shaped.
- Lives under `src/schemas/`, colocated with `GetPromptSchema.ts`/
  `UpdatePromptSchema.ts`, per the current repository layout.
- Consumed by `validateRequestMiddleware(DeletePromptSchema)` (§5); the
  handler reads the parsed value from `req.parsedRequest?.params`, never
  calling `.parse()` itself, mirroring `GetPromptHandler.ts`.

## 7. Persistence adapter

**Schema:** no change — `src/logic/prompt/infrastructure/database/schema.ts`
already defines `prompts.id`, the only column this feature needs.

**`DrizzlePromptRepository`** (existing file, extended) —
`src/logic/prompt/infrastructure/database/DrizzlePromptRepository.ts` adds
`delete`:

```ts
public async delete(id: string): Promise<void> {
    await this.db.delete(prompts).where(eq(prompts.id, id));
}
```

- Filters by `eq(prompts.id, id)` (no `::text` cast, unlike `findById`): by
  the time `delete()` is called, `DeletePromptUseCase` has already confirmed
  a row with this exact `id` exists via `findById`, so `id` is always a
  genuine, well-formed `uuid` value here — identical rationale to
  `update()`'s existing `.where(eq(prompts.id, id))`
  (`006-update-prompt` plan.md §7).
- No foreign key references `prompts.id` from any other table in this
  schema, so no cascading delete concern exists.

**Wiring:**

- `src/logic/prompt/services.ts`: add
  `export const deletePromptUseCase = new DeletePromptUseCase(promptRepository);`,
  reusing the existing `promptRepository` instance.
- `src/app.ts`: add
  `app.delete('/prompts/:id', validateRequestMiddleware(DeletePromptSchema), deletePromptHandler);`.

**Migrations:** none — no schema change.

## 8. Dependency changes

None. `zod`, `express`, and `drizzle-orm` are already installed dependencies.

## 9. Assumptions and risks

**Assumptions**

1. Deletion is a hard (permanent, physical row) delete, not a soft delete
   with a "deleted" flag or timestamp — no such column exists anywhere in
   `src/logic/prompt/infrastructure/database/schema.ts`, and nothing in the
   story implies a need to recover a deleted prompt later. If wrong, this
   would instead need a new nullable `deleted_at`-style column (a genuine
   schema change and migration), plus every read path (`findAll`,
   `findById`) filtering it out — a materially different, larger design,
   requiring a return to the interview.
2. The confirmation response for a successful deletion is a bare `204 No
   Content` with no body (spec Decision #1), by explicit user instruction.
   If wrong, only the handler's success branch and this section of the plan
   change — no use case, port, or persistence impact.
3. `DeletePromptHandler`/`DeletePromptUseCase`/`DeletePromptSchema` file
   names follow existing precedent exactly, mirroring
   `GetPromptHandler.ts`/`GetPromptUseCase.ts`/`GetPromptSchema.ts`. If
   wrong, only renames are needed.
4. `DeletePromptUseCase` detects "not found" via `findById()` returning
   `undefined`, the same pattern already used by `GetPromptUseCase` and
   `UpdatePromptUseCase`, rather than inspecting `delete()`'s own
   affected-row count. If wrong, only the use case's internal check changes
   — no port shape change, since `delete()` already returns `void`.
5. No uniqueness, ownership, or authorization check gates who may delete a
   prompt — this codebase has no auth/ownership concept anywhere yet
   (mirrors the same absence in every prior prompt feature). If wrong, a new
   V#/E# and a use-case-level check would be needed.

**Risks**

1. _(low likelihood, medium impact)_ A race between a delete and a concurrent
   read/update of the same prompt (the read/update's own `findById` succeeds
   just before the delete commits, then its subsequent write targets an
   already-gone row) could silently no-op the second operation. No
   concurrency control exists elsewhere in this codebase (`update`/`create`
   have the same absence). Mitigation: out of scope here; revisit if a
   future feature needs optimistic locking or transactions.
2. _(low likelihood, low impact)_ `delete()`'s `.where(eq(prompts.id, id))`
   (no `::text` cast) relies on `DeletePromptUseCase` always calling it with
   an id already confirmed to exist via `findById` — identical, already-
   accepted risk to `update()`'s (`006-update-prompt` plan.md §9 Risk 3).
   Mitigation: `delete()` is not part of the port's public contract for
   arbitrary ids — only `DeletePromptUseCase` is expected to call it, tested
   at the adapter level only with well-formed, existing ids (tasks.md).
3. _(low likelihood, low impact)_ If a future feature adds a table with a
   foreign key referencing `prompts.id` (e.g. tags, comments) without an
   explicit `ON DELETE` policy, this `delete()` call would then fail at the
   database with a foreign-key-violation error, which is not mapped to any
   domain error here. Mitigation: no such table exists today; revisit this
   adapter and the E1 mapping if/when one is planned.

## 10. Edge cases

- Path `id` matches no existing prompt →
  `DeletePromptUseCase.invoke()` throws `PromptNotFoundError`;
  `DELETE /prompts/:id` responds `404` with
  `{ error: "Prompt not found: <id>" }` (E1, AC4); no row is removed.
- Path `id` is not shaped like a valid identifier (e.g. `"not-a-uuid"`) →
  `findById()` (reused, `::text`-cast comparison) matches no row, so this
  behaves identically to any other unmatched id: `404` (E1), mirroring
  `GetPromptHandler.test.ts`'s "returns 404 when the id is not UUID-shaped"
  precedent.
- Deleting the same id twice in a row → the first call succeeds (`204`);
  the second call's `findById()` now returns `undefined`, so it responds
  `404` (E1, AC5), identical in shape to deleting an id that never existed.
- Successful deletion → a subsequent `GET /prompts/:id` for the same id
  responds `404` (AC2); a subsequent `GET /prompts` (with or without a
  `?category=` filter that previously matched it) no longer includes it in
  the results (AC3) — both follow directly from the row being physically
  removed, no additional filtering logic needed in `findAll`/`findById`.

## 11. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| ----------------------------- | ---------------- |
| Field: id | `DeletePromptQuery.id` (§4); `DeletePromptSchema.params.id` (§6); `prompts.id` column (existing), used as the `WHERE` key in both `findById` (existing) and `delete()` (§7) |
| E1 (prompt not found) | `PromptNotFoundError` (§2, existing); `DeletePromptUseCase.invoke` throw (§4); `DELETE /prompts/:id` `404` mapping in handler (§5) |
| AC1 | `DeletePromptUseCase` (§4), calling `DrizzlePromptRepository.delete(id)` (§7) after the existing `findById` confirms existence; `DELETE /prompts/:id` `204` (§5) |
| AC2 | Physical row removal by `delete()` (§7); a subsequent `GetPromptUseCase`/`GET /prompts/:id` (existing, `003-get-prompt`) finds nothing and responds `404` |
| AC3 | Physical row removal by `delete()` (§7); a subsequent `ListPromptsUseCase`/`GET /prompts` (existing, `002-list-prompts`) never selects the removed row, with or without its former `?category=` filter |
| AC4 | `PromptNotFoundError` (§2); `DeletePromptUseCase.invoke` throw when `findById()` returns `undefined` (§4); `DeletePromptHandler` `try/catch` → `404` (§5) |
| AC5 | Same mechanism as AC4 — `findById()` returns `undefined` for an already-deleted id identically to a never-existing one (§4) |
| Decision #1 (bare `204`, no confirmation payload) | §5 route response (`204`, no body); §9 Assumption 2 |
