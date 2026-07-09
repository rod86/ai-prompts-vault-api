import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';

export type ListPromptsQuery = {
    categoryId?: string;
};

export type ListPromptsResponse = {
    id: string;
    category: { id: string; name: string };
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
};

export class ListPromptsUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: ListPromptsQuery = {}): Promise<ListPromptsResponse[]> {
        return this.repository.findAll({ categoryId: query.categoryId });
    }
}
