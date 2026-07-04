import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ListPromptCategoriesUseCase } from '@logic/prompt/application/ListPromptCategoriesUseCase.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';

const CATEGORIES: PromptCategory[] = [
    { id: faker.string.uuid(), name: faker.commerce.department() },
    { id: faker.string.uuid(), name: faker.commerce.department() },
];

describe('ListPromptCategoriesUseCase', () => {
    let repository: MockProxy<PromptCategoryRepositoryInterface>;
    let useCase: ListPromptCategoriesUseCase;

    beforeEach(() => {
        repository = mock<PromptCategoryRepositoryInterface>();
        useCase = new ListPromptCategoriesUseCase(repository);
    });

    it('returns every category provided by the repository', async () => {
        repository.findAll.mockResolvedValue(CATEGORIES);

        const result = await useCase.invoke();

        expect(result).toEqual(CATEGORIES);
    });

    it('returns an empty array when the repository has none', async () => {
        repository.findAll.mockResolvedValue([]);

        const result = await useCase.invoke();

        expect(result).toEqual([]);
    });
});
