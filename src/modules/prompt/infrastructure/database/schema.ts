import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '@src/modules/user/infrastructure/database/schema.js';

export const promptCategories = pgTable('prompt_categories', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
});

export const prompts = pgTable('prompts', {
    id: uuid('id').primaryKey(),
    promptCategoryId: uuid('prompt_category_id')
        .notNull()
        .references(() => promptCategories.id),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
