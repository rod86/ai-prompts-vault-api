import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';

export interface PromptCategoryResponse {
    id: string;
    name: string;
}

export class ListPromptCategoriesUseCase {
    constructor(private readonly repository: PromptCategoryRepositoryInterface) {}

    public async invoke(): Promise<PromptCategoryResponse[]> {
        return this.repository.findAll();
    }
}
