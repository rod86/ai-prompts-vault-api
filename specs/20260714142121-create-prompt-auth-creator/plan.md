# Plan: Authenticated create-prompt with recorded creator
Spec: specs/20260714142121-create-prompt-auth-creator/spec.md

## 1. Approach

Wire the already-built (but unmounted) `requireAuthMiddleware` onto `POST /prompts`,
ahead of request validation, and thread the authenticated `req.auth.userId` through
the handler into `CreatePromptUseCase`. Persist it as a new **`user_id`** column on
`prompts` (NOT NULL, FK → `users.id`), and expose the creator as a nested
`user: { id, name }` on the `Prompt` entity — exactly mirroring the existing
`category: { id, name }` treatment (`src/modules/prompt/application/CreatePromptUseCase.ts`,
`src/handlers/prompts/createPromptHandler.ts`).

Because the creator is exposed as `{ id, name }` (not just the id), the create use
case returns the fully-resolved entity by **re-reading via `findById`** after
insert, instead of building the return object in memory — `findAll`/`findById` are
updated to `innerJoin` `users`. This avoids adding a separate user-reader port.

To let the prompt persistence layer reference the user table (FK + join) without
breaking hexagonal boundaries, relax `eslint-plugin-boundaries` to permit
cross-context imports **of schema files only** (a new file-scoped `schema` element),
leaving every other cross-context reach-in blocked.

Making `Prompt.user` **required** means `UpdatePromptUseCase` reuses the
already-loaded creator (`existingPrompt.user`) in its return, and existing prompt
test fixtures gain `user`/`user_id`. Rather than leaving that as compile-only
collateral, the **update handler now surfaces the creator**: `updatePromptHandler`
returns `user: { id, name }` (same shape as create), consuming the creator the use
case already carries. Update stays **unauthenticated** and otherwise unchanged
(the creator is the stored one, never re-stamped); delete stays unauthenticated
and body-less.

Reused as-is: `requireAuthMiddleware` + `validateTokenUseCase`
(`specs/20260714105845-auth-token-middleware`, `.../112323-auth-verify-user-exists`),
the `req.auth` typing (`src/types/express.d.ts`), the auth→401 mappings in
`src/middleware/errorMiddleware.ts`, and the `category` fetch/return pattern.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Create route | existing | `src/routes/prompts.routes.ts` | Insert `requireAuthMiddleware` before `validateRequestMiddleware(CreatePromptSchema)` on `POST /prompts`. |
| Create handler | existing | `src/handlers/prompts/createPromptHandler.ts` | Narrow `req.auth` (throw `MissingTokenError` if absent — defensive, satisfies `no-non-null-assertion`); pass `userId: req.auth.userId` into the use case; add `user: prompt.user` to the 201 body. |
| Prompt entity | existing | `src/modules/prompt/domain/Prompt.ts` | `Prompt`: add required `user: { id: string; name: string }`. `CreatePrompt`: add `userId: string`. |
| Create use case | existing | `src/modules/prompt/application/CreatePromptUseCase.ts` | `CreatePromptQuery`: add `userId`. Persist `userId`; return `findById(id)` (throw `PromptCreationError` if unexpectedly missing) instead of the in-memory build. |
| Update use case | existing | `src/modules/prompt/application/UpdatePromptUseCase.ts` | Include `user: existingPrompt.user` in the returned object (original creator preserved) — now consumed by the update response. No auth. |
| Update handler | existing | `src/handlers/prompts/updatePromptHandler.ts` | Add `user: prompt.user` to the 200 response (same shape as create). Route stays unauthenticated. |
| Prompt repository | existing | `src/modules/prompt/infrastructure/database/DrizzlePromptRepository.ts` | `create`: insert `userId`. `findAll` + `findById`: `innerJoin(users)`, select `users.id`/`users.name`, map to `user: { id, name }`. |
| Prompt DB schema | existing | `src/modules/prompt/infrastructure/database/schema.ts` | Import `users`; add `userId: uuid('user_id').notNull().references(() => users.id)`. |
| Migration | new | `drizzle/<generated>.sql` | Add `user_id` column + FK (see §4). |
| Boundaries config | existing | `.eslintrc.json` | Add file-scoped `schema` element (before `infrastructure`); allow `infrastructure`→`schema` and `schema`→`schema` across contexts (see §3). |
| Prompt model factory | existing | `tests/lib/modelFactories/PromptModelFactory.ts` | `PromptModel = Omit<Prompt,'category'\|'user'> & { categoryId; userId }`; factory emits `userId`. |
| Prompt DB helper | existing | `tests/lib/database/prompts.ts` | `insertPrompts` sets `userId` → `user_id`. |
| Existing prompt tests | existing | see §2 note | Add `user`/`userId` to fixtures and seed a `users` row (FK) where prompts are inserted. |

*§2 note — existing tests needing green-keeping fixture updates:* the unit tests that
build a `Prompt`/mock `findById`/`findAll`
(`tests/unit/modules/prompt/application/{Get,Update,Delete,ListPrompts}UseCase.test.ts`)
and the integration tests that insert prompts
(`tests/integration/handlers/prompts/updatePromptHandler.test.ts`,
`tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`).

## 3. Interfaces & contracts

- `POST /prompts` — unchanged request body (`snake_case`: `title`, `prompt`,
  `category_id`, `description?`), now requires `Authorization: Bearer <token>`.
  Success `201` body adds `user: { id, name }` beside the existing `category`.
- `PUT /prompts/:id` — unchanged request/auth (still **no** token required).
  Success `200` body adds `user: { id, name }` (the prompt's stored creator) beside
  the existing `category`.
- `PromptRepositoryInterface.create(prompt: CreatePrompt)` — `CreatePrompt` gains
  `userId`; signature otherwise unchanged. `findById`/`findAll` return `Prompt`
  now carrying `user`.
- `CreatePromptUseCase.invoke(query)` — `CreatePromptQuery` gains `userId`.
- **Boundaries** (`.eslintrc.json`): new element
  `{ "type": "schema", "pattern": "src/modules/*/infrastructure/database/schema.*", "mode": "full", "capture": ["context"] }`
  placed **before** the `infrastructure` element. Add allow-rules: `infrastructure`
  may import `{ type: "schema" }` (any context); `schema` may import `{ type: "schema" }`
  (any context). Verified by `npm run lint` (cross-context schema import passes; a
  non-schema cross-context import still fails).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `MissingTokenError` / `InvalidTokenError` / `TokenExpiredError` (from the auth guard) | `401` `{ error, message }` (already mapped in `errorMiddleware.ts`); no prompt created |
| E2 | `CategoryNotFoundError` | `422` `{ error, message }` (existing mapping); no prompt created |

## 4. Data & persistence

**Table**: prompts (add one column)
| Column | Type | Nullable | Default | Constraints | Description |
|--|--|--|--|--|--|
| id | UUID | No | | Primary key | Existing surrogate id |
| prompt_category_id | UUID | No | — | FK → prompt_categories(id) | Existing |
| user_id | UUID | No | — | FK → users(id) | Creator; traces to §2 `creator`, V2/V3 |
| title | text | No | — | — | Existing |
| prompt | text | No | — | — | Existing |
| description | text | Yes | — | — | Existing |
| created_at | timestamptz | No | — | — | Existing |
| updated_at | timestamptz | No | — | — | Existing |

- Migration: `npx drizzle-kit generate` after the schema change; adds `user_id`
  (NOT NULL) with FK to `users(id)`. Applied manually via `npm run db:migrate`.
  Safe as a fresh NOT NULL column because `prompts` has no rows to backfill
  (Decision 2 / spec §2).
- Rollback: drop the `user_id` column (and its FK) — reverse migration.
- Mapping: domain `userId` ↔ column `user_id`; domain `user: { id, name }` is not
  stored — it is resolved by joining `users` on read.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Request carries a valid authenticated identity, checked before body validation | `requireAuthMiddleware` mounted before `validateRequestMiddleware` on `POST /prompts` | → E1 |
| V2 | Creator = authenticated user, never the body | Handler passes `req.auth.userId`; body schema has no creator field | — |
| V3 | Creator references an existing user | Guaranteed upstream by the auth guard (`validateTokenUseCase` confirms the user exists); enforced at persistence by the `user_id` FK | → E1 upstream; FK violation → `PromptCreationError` (500) on the deleted-mid-request race |

## 6. Dependency changes

none

## 7. Assumptions & risks

Assumptions:
1. `prompts` currently holds no rows, so a NOT NULL `user_id` needs no backfill —
   consequence if wrong: the migration fails until existing rows get a value.
2. The create response exposes `user: { id, name }` only (no email/timestamps),
   matching the `category` shape — consequence if wrong: response contract differs
   from expectation; adjust the handler mapping.
3. Update preserving the original creator is the correct green-keeping behavior
   (creator immutable, Decision 6) — consequence if wrong: update semantics need a
   dedicated spec.
4. The user resolved by the auth guard still exists at insert time; the delete race
   is left to the FK/`PromptCreationError` path rather than a bespoke error —
   consequence if wrong: rare race surfaces as a 500 instead of a tailored message.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Boundaries relaxation is too broad (permits non-schema cross-context imports) | med | erodes hexagonal isolation | Scope the allow strictly to the file-scoped `schema` element; add a lint check that a non-schema cross-context import still fails |
| R2 | Making `Prompt.user` required breaks more constructors than mapped | low | build/suite red | §2 enumerates every `Prompt` constructor; typecheck + full suite gate each task |
| R3 | `innerJoin(users)` on reads hides prompts with a bad `user_id` | low | missing rows on read | `user_id` is NOT NULL + FK, so every prompt has a valid user; inner join is safe |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No Authorization header | valid body, no token | 401 unauthorized; no row written | AC2 |
| Malformed/invalid token | valid body, bad/expired token | 401 unauthorized; no row written | AC2 |
| Unauthenticated + invalid body | no token, missing `title` | 401 (auth wins over validation) | AC3 |
| Authenticated + unknown category | valid token, non-existent `category_id` | 422 unknown category; no row written | AC4 |
| Happy path | valid token, valid body | 201 with `user: { id, name }` + `category`; `user_id` persisted | AC1 |
| Authenticated user deleted mid-request | valid token, user removed before insert | FK violation → `PromptCreationError` (500); no row written | none (accepted race, Assumption 4) |
| Update existing prompt (no auth) | valid update body, existing prompt with a creator | 200 with `user: { id, name }` (original creator, unchanged) + `category` | AC5 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| §2 creator field | schema `user_id` (§4); `Prompt.user`/`CreatePrompt.userId` (§2); handler mapping (§2/§3) |
| V1 | route middleware ordering (§5, §2 route row); E1 (§3) |
| V2 | handler passes `req.auth.userId`; schema has no creator field (§5) |
| V3 | auth guard + `user_id` FK (§4, §5) |
| E1 | auth errors → 401 (§3) |
| E2 | `CategoryNotFoundError` → 422 (§3) |
| AC1 | create handler + use case re-read + repo join (§2, §4) |
| AC2 | `requireAuthMiddleware` on route (§2, §5) |
| AC3 | auth-before-validation ordering (§2 route row, §5 V1) |
| AC4 | existing category validation, now behind auth (§3 E2) |
| AC5 | `UpdatePromptUseCase` returns `user`; `updatePromptHandler` exposes it (§2); PUT response contract (§3) |
