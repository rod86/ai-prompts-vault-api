import { eq, sql } from 'drizzle-orm';
import { type DatabaseConnection, type PromptSchema } from '@src/config/drizzle/index.js';
import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';

export class DrizzlePromptCategoryRepository implements PromptCategoryRepositoryInterface {
    constructor(
        private readonly database: DatabaseClientInterface<DatabaseConnection>,
        private readonly schema: PromptSchema,
    ) {}

    public async findAll(): Promise<PromptCategory[]> {
        const db = this.database.getConnection();
        const { promptCategories } = this.schema;

        return db
            .select({ id: promptCategories.id, name: promptCategories.name })
            .from(promptCategories)
            .orderBy(sql`lower(${promptCategories.name})`, promptCategories.id);
    }

    public async findById(id: string): Promise<PromptCategory | undefined> {
        const db = this.database.getConnection();
        const { promptCategories } = this.schema;

        const rows = await db
            .select({ id: promptCategories.id, name: promptCategories.name })
            .from(promptCategories)
            .where(eq(sql`${promptCategories.id}::text`, id))
            .limit(1);

        return rows[0];
    }
}
