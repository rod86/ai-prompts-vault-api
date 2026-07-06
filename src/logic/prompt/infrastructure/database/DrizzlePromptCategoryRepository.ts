import { eq, sql } from 'drizzle-orm';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { promptCategories } from '@logic/prompt/infrastructure/database/schema.js';
import { type DatabaseConnection } from '@logic/shared/database/DatabaseClient.js';

export class DrizzlePromptCategoryRepository implements PromptCategoryRepositoryInterface {
    constructor(private readonly db: DatabaseConnection) {}

    public async findAll(): Promise<PromptCategory[]> {
        return this.db
            .select({ id: promptCategories.id, name: promptCategories.name })
            .from(promptCategories)
            .orderBy(sql`lower(${promptCategories.name})`, promptCategories.id);
    }

    public async findById(id: string): Promise<PromptCategory | undefined> {
        const rows = await this.db
            .select({ id: promptCategories.id, name: promptCategories.name })
            .from(promptCategories)
            .where(eq(sql`${promptCategories.id}::text`, id))
            .limit(1);

        return rows[0];
    }
}
