import { inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { prompts } from '@logic/prompt/infrastructure/database/schema.js';

type Database = NodePgDatabase<Record<string, unknown>>;

export interface PromptFixture {
    id: string;
    categoryId: string;
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export async function insertPrompts(db: Database, fixtures: PromptFixture[]): Promise<void> {
    if (fixtures.length === 0) {
        return;
    }

    await db.insert(prompts).values(
        fixtures.map((fixture) => ({
            id: fixture.id,
            promptCategoryId: fixture.categoryId,
            title: fixture.title,
            prompt: fixture.prompt,
            description: fixture.description ?? null,
            createdAt: fixture.createdAt,
            updatedAt: fixture.updatedAt,
        })),
    );
}

export async function deletePromptsByIds(db: Database, ids: string[]): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(prompts).where(inArray(prompts.id, ids));
}
