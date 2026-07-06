---
name: testing-patterns
description: Concrete unit/integration testing patterns and fixture conventions used in ai-prompts-vault-api
metadata:
  type: project
---

- **Unit:** `mock<...RepositoryInterface>()` + `repository.findAll.mockResolvedValue(...)`
    - faker for fixtures; build the mock in `beforeEach`.
- **Integration:** open the DB in `beforeAll`; seed/select via
  `tests/lib/database` helpers (one helper per table); `afterEach` deletes
  **only** inserted rows; close in `afterAll`.
- **Shared read-only reference fixtures** (e.g. categories reused by several
  `describe` blocks in one repository test file) are declared once in the
  top-level `describe`'s own `beforeAll`/`afterAll`, not duplicated per
  nested block.
- **Verify `create`/`update`/`delete` via a raw select** (e.g.
  `selectPromptsByIds`), not via the repository's own `findById`/`findAll` —
  a write test shouldn't depend on a different method also being correct.
  The `findAll`/`findById` describe blocks are the exception, since they
  test those methods directly.
- **Empty-state trick:** capture existing rows, delete, assert `findAll()` → `[]`,
  then restore the captured rows in a `finally` block (the categories table is
  never naturally empty — it ships 11 seeded rows).
- **Prompt fixtures must seed a category first** — the FK is NOT NULL, so a
  prompt row needs an existing `prompt_categories` row.
- **Routes:** `supertest` against the real Express `app` in `tests/integration/app.test.ts`.
- **Unit-test builder for a domain entity missing an optional field:** the
  model factory's `create(data)` pattern (`data.field ?? faker...`) cannot
  produce an explicitly-`undefined` optional field, since `undefined ?? x`
  falls through to the faker default. To build a fixture with a field forced
  absent, destructure it off an already-built object instead:
  `const { description: _description, ...rest } = buildPrompt();` — never pass
  `{ description: undefined }` into the factory expecting it to stick.
