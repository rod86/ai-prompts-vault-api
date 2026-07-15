# Plan: Centralize Drizzle schema out of bounded contexts
Spec: specs/20260715075302-centralize-drizzle-schema/spec.md

## 1. Approach

Move the three per-context Drizzle schema files out of
`src/modules/<context>/infrastructure/database/schema.ts` into a new central
directory `src/config/drizzle/`, one `*.schema.ts` file per context plus an
`index.ts` barrel that merges them and owns the schema-derived types. The
`prompts → users` foreign key becomes a sibling import inside the central
directory (not a cross-context import). `auth`'s duplicate `users` table is
deleted; auth reuses the single `users` definition.

Repositories stop importing table objects and instead receive the schema via
their constructor, typed as a per-context `Pick<DatabaseSchema, …>` (structural
subset of the full merged schema). Existing query bodies are reused verbatim by
destructuring the needed tables at the top of each method
(`const { prompts, users } = this.schema;`). Each context's `services.ts` wires
the merged `schema` (from the barrel) into its repositories — the full object is
structurally assignable to any `Pick` of it, so wiring stays `new Repo(client, schema)`.

`drizzle.config.ts` is repointed at the new `*.schema.ts` files; the merged
schema is table-for-table identical, so `drizzle-kit generate` yields no new
migration. The boundary tooling's `schema` element and its two allow-rules
(added by spec `20260714142121-create-prompt-auth-creator`) are removed, since
no cross-context schema import remains. Encapsulation of the central directory
("only `index.ts` is imported from outside") is a documented convention, not a
lint rule (Decision D9).

Reuses existing patterns: `DatabaseClient<DatabaseSchema>` already takes the
schema via constructor (`src/modules/shared/infrastructure/database/DatabaseClient.ts`);
the barrel/merge pattern mirrors the current `src/config/drizzle-schema.ts`.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| User schema | new | `src/config/drizzle/user.schema.ts` | `users` table, moved verbatim from the user module |
| Prompt schema | new | `src/config/drizzle/prompt.schema.ts` | `promptCategories`, `prompts` moved; FK imports `users` from `./user.schema.js` (sibling) |
| Schema barrel | new | `src/config/drizzle/index.ts` | `export const schema` (merged); `export type DatabaseSchema`, `DatabaseConnection`, `PromptSchema`, `UserSchema` (no separate `AuthSchema` — auth reuses `UserSchema`, D10) |
| Old prompt schema | existing → delete | `src/modules/prompt/infrastructure/database/schema.ts` | removed |
| Old user schema | existing → delete | `src/modules/user/infrastructure/database/schema.ts` | removed |
| Old auth schema (dup) | existing → delete | `src/modules/auth/infrastructure/database/schema.ts` | removed (duplicate `users`) |
| Old barrel | existing → delete | `src/config/drizzle-schema.ts` | removed |
| Prompt repository | existing | `src/modules/prompt/infrastructure/database/DrizzlePromptRepository.ts` | inject `PromptSchema`; destructure tables per method; import `DatabaseConnection` from barrel |
| Prompt category repository | existing | `src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.ts` | inject `PromptSchema`; destructure `promptCategories` |
| User repository | existing | `src/modules/user/infrastructure/database/DrizzleUserRepository.ts` | inject `UserSchema`; destructure `users` |
| User-credentials repository | existing | `src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts` | inject `UserSchema`; destructure `users` (now the shared table) |
| Prompt services | existing | `src/modules/prompt/services.ts` | pass `schema` into both prompt repositories |
| User services | existing | `src/modules/user/services.ts` | pass `schema` into user repository |
| Auth services | existing | `src/modules/auth/services.ts` | pass `schema` into credentials repository |
| Shared services | existing | `src/modules/shared/services.ts` | import `schema`/`DatabaseSchema` from barrel; drop local `DatabaseSchema`/`DatabaseConnection` exports |
| Drizzle-kit config | existing | `drizzle.config.ts` | `schema:` → `['./src/config/drizzle/user.schema.ts', './src/config/drizzle/prompt.schema.ts']` |
| Boundary config | existing | `.eslintrc.json` | remove `schema` element + `from:schema` rule + `to:schema` allowance in the infrastructure rule |
| Test DB helpers | existing | `tests/lib/database/{prompts,users,promptCategories}.ts` | import `{ schema }` from barrel; use `schema.<table>` |
| Integration tests | existing | `tests/integration/**` (12 files) | import `{ schema }` and `DatabaseSchema`/`DatabaseConnection` from barrel instead of old paths |

## 3. Interfaces & contracts

Barrel (`src/config/drizzle/index.ts`):

```ts
export const schema = { ...userSchema, ...promptSchema };
export type DatabaseSchema = typeof schema;
export type DatabaseConnection = NodePgDatabase<DatabaseSchema>;
export type PromptSchema = Pick<DatabaseSchema, 'prompts' | 'promptCategories' | 'users'>;
export type UserSchema = Pick<DatabaseSchema, 'users'>; // shared by user + auth contexts (D10)
```

Repository constructor shape (unchanged first param, new second param):

```ts
constructor(
    private readonly database: DatabaseClientInterface<DatabaseConnection>,
    private readonly schema: PromptSchema, // or UserSchema (user + auth)
) {}
```

No spec §4 errors to map — the feature has no error responses.

## 4. Data & persistence

No database change. Tables (`users`, `prompt_categories`, `prompts`) keep their
exact columns, types, keys, and the `users_email_lower_unique` index. The
definitions only relocate and the duplicate `users` (auth) is removed from the
codebase; it was never part of `drizzle.config.ts`, so the generated schema is
unchanged.

- Migration: none. `npx drizzle-kit generate` must report no pending changes.
- Rollback: none required (no migration).
- Mapping: unchanged (`promptCategoryId ↔ prompt_category_id`, `userId ↔ user_id`,
  `passwordHash ↔ password_hash`, `createdAt/updatedAt ↔ created_at/updated_at`).

## 5. Validation

None — spec §3 defines no validation rules.

## 6. Dependency changes

None.

## 7. Assumptions & risks

Assumptions:
1. `drizzle-kit` reads Drizzle table objects from the files listed in
   `drizzle.config.ts`; pointing it at the two `*.schema.ts` files (which export
   the tables at top level) is sufficient — consequence if wrong: the migration
   diff in T2 would flag it immediately and the config target is corrected.
2. Passing the full merged `schema` where a `Pick<DatabaseSchema, …>` is expected
   type-checks (structural subtyping) — consequence if wrong: wiring gains an
   explicit narrowing at the call site; no behavior impact.
3. Importing from `src/config/drizzle/**` is boundary-legal from infrastructure
   (config is not a bounded-context element; `boundaries/no-unknown` is off) —
   consequence if wrong: add a `config` boundary element with an allow rule.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | A stray importer of an old schema path is missed, breaking the build | low | med | T8 deletes old files only after T3–T7 repoint; type-check/lint gate in T10 catches any leftover |
| R2 | `drizzle-kit` emits a spurious migration from the file move | low | med | T2 runs `generate` right after repointing config, before deleting anything |
| R3 | Auth dedupe subtly changes credential lookups | low | high | Behavior covered by existing auth integration tests; T5 keeps query bodies verbatim |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Prompt join across contexts | `findAll`/`findById` joining prompts→categories→users | Same rows as before; `users` now the centralized table | AC6 |
| Auth credential lookup | `findByEmail`/`findById` on the shared `users` | Identical results to the pre-dedupe duplicate table | AC2, AC6 |
| Migration diff after move | `drizzle-kit generate` post-change | No pending migration | AC7 |
| Boundary lint after exception removal | `npm run lint` with `schema` element removed | Passes; no cross-context violation reported | AC1, AC5 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| AC1 (no cross-context schema import) | §1 sibling FK inside central dir; §2 repo injection; §2 `.eslintrc.json`; §8 boundary-lint case |
| AC2 (single shared record) | §2 delete auth dup + inject `UserSchema` (D10); §4 note; §8 auth case |
| AC3 (single entry point) | §2 `index.ts` barrel; §3 barrel exports; D7/D9 |
| AC4 (schema injected, not imported) | §2 all four repositories; §3 constructor shape |
| AC5 (exception removed, lint passes) | §2 `.eslintrc.json`; §8 boundary-lint case |
| AC6 (tests + type-check pass) | §2 services wiring + test-import updates; §8 join/auth cases |
| AC7 (no new migration) | §2 `drizzle.config.ts`; §4 migration=none; §8 migration-diff case |
