import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';

export type PromptCategoryResponse = {
    id: string;
    name: string;
};

export class ListPromptCategoriesUseCase {
    constructor(private readonly repository: PromptCategoryRepositoryInterface) {}

    public async invoke(): Promise<PromptCategoryResponse[]> {
        return this.repository.findAll();
    }
}
