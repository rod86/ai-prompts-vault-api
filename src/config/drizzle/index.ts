import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as tables from '@src/config/drizzle/schema.js';

export const schema = { ...tables };

export type DatabaseSchema = typeof schema;
export type DatabaseConnection = NodePgDatabase<DatabaseSchema>;
export type PromptSchema = Pick<DatabaseSchema, 'prompts' | 'promptCategories' | 'users'>;
export type UserSchema = Pick<DatabaseSchema, 'users'>;
