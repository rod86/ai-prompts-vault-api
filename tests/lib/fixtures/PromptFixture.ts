import { inArray } from 'drizzle-orm';
import { schema } from '@src/config/drizzle/index.js';
import { type TestDatabaseClient } from '@tests/lib/config.js';
import { AbstractFixture } from '@tests/lib/fixtures/AbstractFixture.js';
import {
    type PromptModel,
    type PromptModelFactory,
} from '@tests/lib/modelFactories/PromptModelFactory.js';

export class PromptFixture extends AbstractFixture<PromptModel> {
    constructor(
        databaseClient: TestDatabaseClient,
        private readonly modelFactory: PromptModelFactory,
    ) {
        super(databaseClient);
    }

    public async insert(data?: Partial<PromptModel>): Promise<PromptModel> {
        const prompt = this.modelFactory.create(data);
        const { categoryId, ...other } = prompt;
        await this.db.insert(schema.prompts).values({
            ...other,
            promptCategoryId: categoryId,
        });
        this.register(prompt.id);
        return prompt;
    }

    public async cleanup(): Promise<void> {
        if (this.ids.size === 0) {
            return;
        }

        await this.db.delete(schema.prompts).where(inArray(schema.prompts.id, [...this.ids]));
        this.ids.clear();
    }
}
