# Tasks: Always return the prompt description on create and update
Plan: specs/20260714091015-prompt-description-always-in-response/plan.md

- [x] T1. Create response returns `description: null` when omitted
  - Type: route handler
  - Depends on: none
  - Red: In `tests/integration/handlers/prompts/createPromptHandler.test.ts`, change the
    existing "not submitted" test (currently asserting `response.body` has no
    `description` property) to assert the response body includes `description: null`
    (keep the assertion that it is persisted as `null`). Against the current handler,
    which omits the key, this fails.
  - Green: In `src/handlers/prompts/createPromptHandler.ts`, replace
    `...(prompt.description !== undefined && { description: prompt.description })` with
    `description: prompt.description || null`.
  - Covers: AC1 "Given a create request that omits the description, When the client creates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`)."

- [x] T2. Create response returns `description: null` for an empty-string description
  - Type: route handler
  - Depends on: T1
  - Red: In the same create test file, add a test that submits `description: ''`, asserts
    `response.body.description` is `null`, and asserts the prompt is persisted with an
    empty-string description (`''`). Before T1's handler change this returned `''`; the
    test locks the empty-string branch of the coalescing added in T1.
  - Green: No production change — the `|| null` coalescing from T1 already renders `''`
    as `null` while persistence keeps `''` (no persistence code changed).
  - Covers: AC2 "Given a create request whose description is empty text, When the client creates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`), and the stored prompt is unaffected by this change (its description is still stored as empty text)."

- [x] T3. Update response returns `description: null` when omitted
  - Type: route handler
  - Depends on: none
  - Red: In `tests/integration/handlers/prompts/updatePromptHandler.test.ts`, change the
    existing "clears the description when it is omitted" test (currently asserting
    `response.body` has no `description` property) to assert the response body includes
    `description: null` (keep the assertion that it is persisted as `null`). Against the
    current handler, which omits the key, this fails.
  - Green: In `src/handlers/prompts/updatePromptHandler.ts`, replace
    `...(prompt.description !== undefined && { description: prompt.description })` with
    `description: prompt.description || null`.
  - Covers: AC3 "Given an update request that omits the description, When the client updates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`)."

- [ ] T4. Update response returns `description: null` for an empty-string description
  - Type: route handler
  - Depends on: T3
  - Red: In the same update test file, change the existing "sets the description to an
    empty string when submitted as one" test so its response assertion expects
    `response.body.description` to be `null` (instead of `''`), while keeping its
    assertion that the prompt is persisted with `''`. This asserts the new
    response-representation contract without changing persistence.
  - Green: No production change — the `|| null` coalescing from T3 already renders `''`
    as `null` while persistence keeps `''`.
  - Covers: AC4 "Given an update request whose description is empty text, When the client updates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`), while the stored prompt still keeps the empty text (persistence is unchanged)."

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a create request that omits the description, When the client creates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`). | T1 |
| AC2 | Given a create request whose description is empty text, When the client creates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`), and the stored prompt is unaffected by this change (its description is still stored as empty text). | T2 |
| AC3 | Given an update request that omits the description, When the client updates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`). | T3 |
| AC4 | Given an update request whose description is empty text, When the client updates the prompt, Then the response body includes a description field whose value is the explicit empty value (`null`), while the stored prompt still keeps the empty text (persistence is unchanged). | T4 |
