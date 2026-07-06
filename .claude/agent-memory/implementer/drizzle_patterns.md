---
name: drizzle-patterns
description: Concrete Drizzle ORM/schema conventions used across ai-prompts-vault-api's adapters
metadata:
  type: project
---

- `pgTable(...)` in `schema.ts`.
- `uuid('id').primaryKey()` — **no** default; the caller always supplies the id.
- `text(...).notNull()` for required text; nullable `text('description')` for optional.
- FK: `.references(() => promptCategories.id)` (+ `.notNull()` when required).
- Timestamps: `timestamp('created_at', { withTimezone: true }).notNull()`.
- Read query: `.innerJoin(...).where(whereClause).orderBy(desc(createdAt), id)`.
- Case-insensitive order: `orderBy(sql\`lower(${col})\`, id)`.
- Optional filter clause: `filter?.categoryId ? eq(prompts.promptCategoryId, filter.categoryId) : undefined`.
- Optional column → domain: `description: row.description ?? undefined` (null→undefined).
