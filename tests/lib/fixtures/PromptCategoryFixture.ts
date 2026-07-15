import { inArray } from 'drizzle-orm';
import { schema } from '@src/config/drizzle/index.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import { type TestDatabaseClient } from '@tests/lib/config.js';
import { AbstractFixture } from '@tests/lib/fixtures/AbstractFixture.js';
import { type PromptCategoryModelFactory } from '@tests/lib/modelFactories/PromptCategoryModelFactory.js';

export class PromptCategoryFixture extends AbstractFixture<PromptCategory> {
    constructor(
        databaseClient: TestDatabaseClient,
        private readonly modelFactory: PromptCategoryModelFactory,
    ) {
        super(databaseClient);
    }

    public async insert(data?: Partial<PromptCategory>): Promise<PromptCategory> {
        const category = this.modelFactory.create(data);
        await this.db.insert(schema.promptCategories).values(category);
        this.register(category.id);
        return category;
    }

    public async cleanup(): Promise<void> {
        if (this.ids.size === 0) {
            return;
        }

        await this.db
            .delete(schema.promptCategories)
            .where(inArray(schema.promptCategories.id, [...this.ids]));
        this.ids.clear();
    }
}
