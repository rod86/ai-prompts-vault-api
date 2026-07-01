import type CategoryRepositoryInterface from '@logic/prompts/domain/interfaces/CategoryRepositoryInterface.js';

export interface ListCategoriesResponse {
    categories: { id: string; name: string }[];
}

export class ListCategoriesUseCase {
    constructor(private readonly categoryRepository: CategoryRepositoryInterface) {}

    public async invoke(): Promise<ListCategoriesResponse> {
        const categories = await this.categoryRepository.findAll();

        return {
            categories: categories.map((category) => ({
                id: category.id,
                name: category.name,
            })),
        };
    }
}
