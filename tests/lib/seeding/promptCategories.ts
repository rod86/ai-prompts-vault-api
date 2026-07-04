import { inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { promptCategories } from '@logic/prompt/infrastructure/database/schema.js';

type Database = NodePgDatabase<Record<string, unknown>>;

export async function insertPromptCategories(
    db: Database,
    categories: PromptCategory[],
): Promise<void> {
    if (categories.length === 0) {
        return;
    }

    await db.insert(promptCategories).values(categories);
}

export async function deletePromptCategoriesByIds(db: Database, ids: string[]): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(promptCategories).where(inArray(promptCategories.id, ids));
}

export async function getAllPromptCategories(db: Database): Promise<PromptCategory[]> {
    return db.select({ id: promptCategories.id, name: promptCategories.name }).from(promptCategories);
}

export async function deleteAllPromptCategories(db: Database): Promise<void> {
    await db.delete(promptCategories);
}
