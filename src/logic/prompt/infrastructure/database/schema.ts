import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const promptCategories = pgTable('prompt_categories', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
});
