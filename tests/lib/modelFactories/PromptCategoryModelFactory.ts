import { faker } from '@faker-js/faker';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { AbstractModelFactory } from '@tests/lib/modelFactories/AbstractModelFactory.js';

export class PromptCategoryModelFactory extends AbstractModelFactory<PromptCategory> {
    override create(data: Partial<PromptCategory> = {}): PromptCategory {
        return {
            id: data.id ?? faker.string.uuid(),
            name: data.name ?? faker.commerce.department(),
        };
    }
}
