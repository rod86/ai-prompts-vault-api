import { inArray } from 'drizzle-orm';
import { prompts } from '@logic/prompt/infrastructure/database/schema.js';
import { type TestDatabaseConnection } from '@tests/lib/config.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';

export async function insertPrompts(
    db: TestDatabaseConnection,
    fixtures: PromptModel[],
): Promise<void> {
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

export async function deletePromptsByIds(
    db: TestDatabaseConnection,
    ids: string[],
): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(prompts).where(inArray(prompts.id, ids));
}
