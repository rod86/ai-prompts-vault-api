import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as promptSchema from '@src/config/drizzle/prompt.schema.js';
import * as userSchema from '@src/config/drizzle/user.schema.js';

export const schema = {
    ...userSchema,
    ...promptSchema,
};

export type DatabaseSchema = typeof schema;
export type DatabaseConnection = NodePgDatabase<DatabaseSchema>;
export type PromptSchema = Pick<DatabaseSchema, 'prompts' | 'promptCategories' | 'users'>;
export type UserSchema = Pick<DatabaseSchema, 'users'>;
