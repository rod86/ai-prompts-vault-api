import { inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { prompts } from '@logic/prompt/infrastructure/database/schema.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';

type Database = NodePgDatabase<Record<string, unknown>>;

export async function insertPrompts(db: Database, fixtures: PromptModel[]): Promise<void> {
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
