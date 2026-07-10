import { inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { promptCategories } from '@logic/prompt/infrastructure/database/schema.js';

export async function insertPromptCategories(
    db: NodePgDatabase<Record<string, unknown>>,
    categories: PromptCategory[],
): Promise<void> {
    if (categories.length === 0) {
        return;
    }

    await db.insert(promptCategories).values(categories);
}

export async function deletePromptCategoriesByIds(
    db: NodePgDatabase<Record<string, unknown>>,
    ids: string[],
): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(promptCategories).where(inArray(promptCategories.id, ids));
}
