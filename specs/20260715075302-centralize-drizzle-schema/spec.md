# Spec: Centralize Drizzle schema out of bounded contexts
Status: READY TO IMPLEMENT
Story: As a developer, I want the persistence schema definitions centralized in one shared location and injected into repositories, so that bounded contexts no longer import one another's schema and the cross-context boundary exception can be removed.

<!--
This is a structural (behavior-neutral) refactor. It has no user-facing fields,
validation, or error behavior; "behavior" here is the developer-observable
structure of the codebase and the invariant that runtime behavior is unchanged.
Acceptance is proven by structural inspection plus the existing test suite,
type-check, lint, and a no-op migration diff.
-->

## 1. Behavior

Today each bounded context owns its own persistence schema definition, and one
context reaches into another context's schema to satisfy a foreign-key
relationship and a join. A second context redefines the same shared record
independently, producing a duplicate definition of one stored entity. A
dedicated exception was added to the boundary-checking tooling specifically to
permit these cross-context schema imports.

After this change:

- All schema definitions live in a single shared location, outside every
  bounded context, exposed through one entry point.
- Each stored entity is defined exactly once; the previously duplicated record
  has a single definition that every context shares.
- A repository receives the schema it needs through construction rather than by
  importing schema definitions itself.
- The boundary-tooling exception that allowed cross-context schema imports is
  removed, returning the boundary rules to their pre-exception state.
- Runtime behavior is unchanged: the same data is read and written, the existing
  test suite passes, and no new database migration is required.

## 2. Fields

None — no new or changed user-facing data. The stored records are unchanged;
this refactor only relocates and deduplicates their definitions.

## 3. Validation rules

None — this refactor introduces no user-facing input or validation behavior.

## 4. Error responses

None — this refactor introduces no user-facing error behavior.

## 5. Acceptance criteria

- **AC1** — Given any bounded context's persistence code, When its imports are
  inspected, Then it imports no schema definition belonging to another bounded
  context.
- **AC2** — Given the record that was previously defined in two contexts, When
  the centralized schema is inspected, Then that record is defined exactly once
  and every context that uses it shares that single definition.
- **AC3** — Given the centralized schema location, When any code outside that
  location imports the schema, Then it imports only through the single entry
  point (never a per-context schema file directly).
- **AC4** — Given a repository, When it is constructed, Then it receives its
  schema through construction and contains no direct import of schema
  definitions.
- **AC5** — Given the boundary-checking tooling, When the linter runs, Then the
  cross-context schema exception is absent and the lint passes.
- **AC6** — Given the completed change, When the full test suite and the
  type-check run, Then all existing tests pass and the type-check is clean,
  with no change to existing behavior.
- **AC7** — Given the completed change, When the migration generator runs
  against the centralized schema, Then no new migration is produced (the
  database-level schema is identical to before).

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | How do repositories obtain their schema tables? | Constructor injection of a narrowed schema view (per-context `Pick` of the full schema) | AC4 — schema is injected, not imported |
| D2 | Remove the duplicate definition of the shared user record now? | Yes, dedupe in this change | AC2 — single definition shared across contexts |
| D3 | Should the shared entry point use a default export or named exports? | Named exports only (multiple things exported) | Shapes AC3 entry point |
| D4 | Type names for the schema and per-context views? | `DatabaseSchema`, `PromptSchema`, `UserSchema`, `AuthSchema` | Naming used in plan |
| D5 | Name of the single entry file? | `index.ts` (barrel = the one public door) | AC3 entry point |
| D6 | How much of the existing repository query code changes? | Only the constructor signature/type; query bodies reused verbatim | Bounds the change to behavior-neutral |
| D7 | How do consumers outside the schema location obtain individual tables? | Entry point exposes the merged `schema` object + types only; consumers access tables via `schema.<table>` | AC3; keeps entry surface minimal |
| D8 | Where do the `DatabaseSchema`/connection types live? | Both move into the entry point; all importers are repointed to it | Single home for schema-derived types |
| D9 | Enforce "only the entry point is importable" via tooling or convention? | Convention only (documented; no lint rule added) | AC3 stated as a convention, not tool-enforced |
| D10 | (Directive) Auth's schema view and the duplicate per-context type | Auth reuses `UserSchema`; the separate `AuthSchema` type is dropped — no two structurally identical schema-view types. Supersedes the `AuthSchema` part of D4 | Removes a duplicate type; both user and auth contexts inject `UserSchema` |
