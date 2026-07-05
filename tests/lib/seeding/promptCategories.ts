import { inArray } from 'drizzle-orm';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { promptCategories } from '@logic/prompt/infrastructure/database/schema.js';
import { type TestDatabaseConnection } from '@tests/lib/config.js';

export async function insertPromptCategories(
    db: TestDatabaseConnection,
    categories: PromptCategory[],
): Promise<void> {
    if (categories.length === 0) {
        return;
    }

    await db.insert(promptCategories).values(categories);
}

export async function deletePromptCategoriesByIds(
    db: TestDatabaseConnection,
    ids: string[],
): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(promptCategories).where(inArray(promptCategories.id, ids));
}
