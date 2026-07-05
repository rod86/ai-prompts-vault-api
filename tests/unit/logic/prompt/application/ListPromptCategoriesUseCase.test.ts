import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ListPromptCategoriesUseCase } from '@logic/prompt/application/ListPromptCategoriesUseCase.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';

describe('ListPromptCategoriesUseCase', () => {
    let repository: MockProxy<PromptCategoryRepositoryInterface>;
    let useCase: ListPromptCategoriesUseCase;
    const categories = promptCategoryModelFactory.createMany(2);

    beforeEach(() => {
        repository = mock<PromptCategoryRepositoryInterface>();
        useCase = new ListPromptCategoriesUseCase(repository);
    });

    it('returns every category provided by the repository', async () => {
        repository.findAll.mockResolvedValue(categories);

        const result = await useCase.invoke();

        expect(result).toEqual(categories);
    });

    it('returns an empty array when the repository has none', async () => {
        repository.findAll.mockResolvedValue([]);

        const result = await useCase.invoke();

        expect(result).toEqual([]);
    });
});
