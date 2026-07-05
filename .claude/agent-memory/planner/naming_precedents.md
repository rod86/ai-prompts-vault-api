---
name: naming-precedents
description: File/class/table naming precedents to reuse verbatim for new features
metadata:
  type: feedback
---

- Handler file: `Get<Resource>.ts` (`GetCategories.ts`, `GetPrompts.ts`),
  `Create<Resource>.ts` for writes (`CreatePromptHandler.ts`).
- Use case: `List<X>UseCase.ts` / `Get<X>UseCase.ts` / `Create<X>UseCase.ts`,
  filename = class name.
- Port: `<Entity>RepositoryInterface`; adapter: `Drizzle<Entity>Repository`.
- Tables: owned entity → prefixed (`prompt_categories`); standalone → plain
  plural (`prompts`); FK column → referenced entity + `_id`
  (`prompt_category_id`).
- Routes are user-facing and independent of table names (`/categories`, not
  `/prompt_categories`).

**Why:** consistent naming across specs 001-005; deviating creates review
friction.
**How to apply:** reuse these patterns silently (trivial naming decision, log
as a plan.md assumption, never ask the user).
