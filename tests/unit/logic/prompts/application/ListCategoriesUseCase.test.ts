import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { ListCategoriesUseCase } from '@logic/prompts/application/ListCategoriesUseCase.js';
import type PromptCategoryRepositoryInterface from '@logic/prompts/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type { PromptCategory } from '@logic/prompts/domain/PromptCategory.js';

const DEVOPS: PromptCategory = { id: '36f49137-14ce-4c1d-843f-ca18cfb67415', name: 'devops' };
const FRONTEND: PromptCategory = { id: 'a1b2c3d4-0000-4000-8000-000000000000', name: 'frontend' };

describe('ListCategoriesUseCase', () => {
    let repository: MockProxy<PromptCategoryRepositoryInterface>;
    let useCase: ListCategoriesUseCase;

    beforeEach(() => {
        repository = mock<PromptCategoryRepositoryInterface>();
        useCase = new ListCategoriesUseCase(repository);
    });

    it('returns every category as a plain id/name shape in the order the port provides', async () => {
        // Arrange
        repository.findAll.mockResolvedValue([DEVOPS, FRONTEND]);

        // Act
        const response = await useCase.invoke();

        // Assert
        expect(response).toEqual({
            categories: [
                { id: DEVOPS.id, name: DEVOPS.name },
                { id: FRONTEND.id, name: FRONTEND.name },
            ],
        });
    });

    it('returns an empty list without error when no categories exist', async () => {
        // Arrange
        repository.findAll.mockResolvedValue([]);

        // Act
        const response = await useCase.invoke();

        // Assert
        expect(response).toEqual({ categories: [] });
    });
});
