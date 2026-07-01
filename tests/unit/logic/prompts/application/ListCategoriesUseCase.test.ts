import { describe, expect, it } from 'vitest';

import { ListCategoriesUseCase } from '@logic/prompts/application/ListCategoriesUseCase.js';
import type CategoryRepositoryInterface from '@logic/prompts/domain/interfaces/CategoryRepositoryInterface.js';
import type { PromptCategory } from '@logic/prompts/domain/PromptCategory.js';

class FakeCategoryRepository implements CategoryRepositoryInterface {
    constructor(private readonly categories: PromptCategory[]) {}

    public async findAll(): Promise<PromptCategory[]> {
        return this.categories;
    }
}

const DEVOPS: PromptCategory = { id: '36f49137-14ce-4c1d-843f-ca18cfb67415', name: 'devops' };
const FRONTEND: PromptCategory = { id: 'a1b2c3d4-0000-4000-8000-000000000000', name: 'frontend' };

describe('ListCategoriesUseCase', () => {
    it('returns every category as a plain id/name shape in the order the port provides', async () => {
        // Arrange
        const repository = new FakeCategoryRepository([DEVOPS, FRONTEND]);
        const useCase = new ListCategoriesUseCase(repository);

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
        const repository = new FakeCategoryRepository([]);
        const useCase = new ListCategoriesUseCase(repository);

        // Act
        const response = await useCase.invoke();

        // Assert
        expect(response).toEqual({ categories: [] });
    });
});
