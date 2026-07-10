import { eq, sql } from 'drizzle-orm';
import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import { promptCategories } from '@src/modules/prompt/infrastructure/database/schema.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { type DatabaseSchema } from '@src/modules/shared/services.js';

export class DrizzlePromptCategoryRepository implements PromptCategoryRepositoryInterface {
    constructor(private readonly database: DatabaseClientInterface<DatabaseSchema>) {}

    public async findAll(): Promise<PromptCategory[]> {
        const db = this.database.getConnection();

        return db
            .select({ id: promptCategories.id, name: promptCategories.name })
            .from(promptCategories)
            .orderBy(sql`lower(${promptCategories.name})`, promptCategories.id);
    }

    public async findById(id: string): Promise<PromptCategory | undefined> {
        const db = this.database.getConnection();

        const rows = await db
            .select({ id: promptCategories.id, name: promptCategories.name })
            .from(promptCategories)
            .where(eq(sql`${promptCategories.id}::text`, id))
            .limit(1);

        return rows[0];
    }
}
