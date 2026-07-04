import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';

export interface ListPromptsQuery {
    categoryId?: string;
}

export interface ListPromptsResponse {
    id: string;
    category: { id: string; name: string };
    title: string;
    prompt: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class ListPromptsUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: ListPromptsQuery = {}): Promise<ListPromptsResponse[]> {
        return this.repository.findAll({ categoryId: query.categoryId });
    }
}
