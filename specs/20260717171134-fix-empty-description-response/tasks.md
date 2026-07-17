# Tasks: Echo empty prompt descriptions faithfully
Plan: specs/20260717171134-fix-empty-description-response/plan.md

- [ ] T1. Create confirmation echoes an empty description as empty text
  - Type: route handler
  - Depends on: none
  - Red: In `tests/integration/handlers/prompts/createPromptHandler.test.ts`, amend the
    empty-description case (~line 137, currently "returns description: null and stores it
    as empty text when submitted as empty") — rename it to reflect echoing the empty text,
    and change `expect(response.body.description).toBeNull()` to
    `expect(response.body.description).toBe('')`. Leave the persistence assertion
    (`expect(persisted?.description).toBe('')`) and the existing
    `CreatePromptResponseSchema.parse(...)` assertion unchanged. This fails now because
    the handler's `|| null` returns `null` for `''`.
  - Green: In `src/handlers/prompts/createPromptHandler.ts` line 29, change
    `description: prompt.description || null` to `description: prompt.description ?? null`.
    Keep the existing "not submitted" test (AC3) green — `undefined ?? null` is still `null`.
  - Covers: AC1 "Given a user creating a prompt, When they supply an empty description, Then the create confirmation reports the description as an empty text (not absent) and the stored description is an empty text."; also keeps AC3 green; V1

- [ ] T2. Update confirmation echoes an empty description as empty text
  - Type: route handler
  - Depends on: none
  - Red: In `tests/integration/handlers/prompts/updatePromptHandler.test.ts`, amend the
    empty-description case (~line 136, "sets the description to an empty string when
    submitted as one, instead of clearing it") — change
    `expect(response.body.description).toBeNull()` to
    `expect(response.body.description).toBe('')`. Leave the persistence assertion
    (`expect(persisted?.description).toBe('')`) unchanged. This fails now because the
    handler's `|| null` returns `null` for `''`.
  - Green: In `src/handlers/prompts/updatePromptHandler.ts` line 30, change
    `description: prompt.description || null` to `description: prompt.description ?? null`.
    Keep the existing "clears the description when it is omitted" test (AC4) green.
  - Covers: AC2 "Given a user updating a prompt, When they supply an empty description, Then the update confirmation reports the description as an empty text (not absent) and the stored description is an empty text."; also keeps AC4 green; V1

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a user creating a prompt, When they supply an empty description, Then the create confirmation reports the description as an empty text (not absent) and the stored description is an empty text. | T1 |
| AC2 | Given a user updating a prompt, When they supply an empty description, Then the update confirmation reports the description as an empty text (not absent) and the stored description is an empty text. | T2 |
| AC3 | Given a user creating a prompt, When they omit the description, Then the create confirmation reports the description as absent and the stored description is absent. | T1 (existing "not submitted" test kept green) |
| AC4 | Given a user updating a prompt, When they omit the description, Then the update confirmation reports the description as absent and any previous description is cleared. | T2 (existing "omitted" test kept green) |
