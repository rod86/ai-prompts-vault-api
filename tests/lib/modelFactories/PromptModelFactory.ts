import { faker } from '@faker-js/faker';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';
import { AbstractModelFactory } from '@tests/lib/modelFactories/AbstractModelFactory.js';

type PromptModel = Omit<Prompt, 'category'> & { categoryId: string };

export class PromptModelFactory extends AbstractModelFactory<PromptModel> {
    override create(data: Partial<PromptModel> = {}): PromptModel {
        return {
            id: data.id ?? faker.string.uuid(),
            categoryId: data.categoryId ?? faker.string.uuid(),
            title: data.title ?? faker.lorem.sentence(),
            prompt: data.prompt ?? faker.lorem.paragraph(),
            description: data.description ?? faker.lorem.sentence(),
            createdAt: data.createdAt ?? faker.date.past({ years: 2 }),
            updatedAt: data.updatedAt ?? faker.date.recent(),
        };
    }
}
