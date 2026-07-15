import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
    'users',
    {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        email: text('email').notNull(),
        passwordHash: text('password_hash').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    },
    (table) => [uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`)],
);
