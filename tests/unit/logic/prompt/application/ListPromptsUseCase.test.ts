import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ListPromptsUseCase } from '@logic/prompt/application/ListPromptsUseCase.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';

const PROMPTS: Prompt[] = [
    {
        id: faker.string.uuid(),
        category: { id: faker.string.uuid(), name: faker.commerce.department() },
        title: faker.lorem.words(3),
        prompt: faker.lorem.paragraph(),
        description: faker.lorem.sentence(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
    },
    {
        id: faker.string.uuid(),
        category: { id: faker.string.uuid(), name: faker.commerce.department() },
        title: faker.lorem.words(3),
        prompt: faker.lorem.paragraph(),
        description: faker.lorem.sentence(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
    },
];

describe('ListPromptsUseCase', () => {
    let repository: MockProxy<PromptRepositoryInterface>;
    let useCase: ListPromptsUseCase;

    beforeEach(() => {
        repository = mock<PromptRepositoryInterface>();
        useCase = new ListPromptsUseCase(repository);
    });

    it('returns every prompt provided by the repository', async () => {
        repository.findAll.mockResolvedValue(PROMPTS);

        const result = await useCase.invoke();

        expect(result).toEqual(PROMPTS);
    });

    it('returns an empty array when the repository has none', async () => {
        repository.findAll.mockResolvedValue([]);

        const result = await useCase.invoke();

        expect(result).toEqual([]);
    });

    it('forwards a supplied category filter to the repository unchanged', async () => {
        const categoryId = faker.string.uuid();
        repository.findAll.mockResolvedValue([]);

        await useCase.invoke({ categoryId });

        expect(repository.findAll).toHaveBeenCalledWith({ categoryId });
    });
});
