import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ListPromptsUseCase } from '@src/modules/prompt/application/ListPromptsUseCase.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';
import { promptModelFactory, promptCategoryModelFactory } from '@tests/lib/config.js';

const buildPrompt = (): Prompt => {
    const { categoryId: _categoryId, userId: _userId, ...prompt } = promptModelFactory.create();
    return {
        ...prompt,
        category: promptCategoryModelFactory.create(),
        user: { id: faker.string.uuid(), name: faker.person.fullName() },
    };
};

describe('ListPromptsUseCase', () => {
    let repository: MockProxy<PromptRepositoryInterface>;
    let useCase: ListPromptsUseCase;
    const prompts = [buildPrompt(), buildPrompt()];

    beforeEach(() => {
        repository = mock<PromptRepositoryInterface>();
        useCase = new ListPromptsUseCase(repository);
    });

    it('returns every prompt provided by the repository', async () => {
        repository.findAll.mockResolvedValue(prompts);

        const result = await useCase.invoke();

        expect(result).toEqual(prompts);
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
