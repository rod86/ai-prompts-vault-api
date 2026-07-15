import { eq, inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@src/config/drizzle/index.js';

const { prompts } = schema;

export async function selectPromptsByIds(
    db: NodePgDatabase<Record<string, unknown>>,
    ids: string[],
): Promise<(typeof prompts.$inferSelect)[]> {
    if (ids.length === 0) {
        return [];
    }

    return db.select().from(prompts).where(inArray(prompts.id, ids));
}

export async function selectPromptsByCategoryId(
    db: NodePgDatabase<Record<string, unknown>>,
    categoryId: string,
): Promise<(typeof prompts.$inferSelect)[]> {
    return db.select().from(prompts).where(eq(prompts.promptCategoryId, categoryId));
}
