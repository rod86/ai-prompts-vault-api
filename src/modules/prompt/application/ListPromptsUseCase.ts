import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';

export type ListPromptsQuery = {
    categoryId?: string;
};

export class ListPromptsUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: ListPromptsQuery = {}): Promise<Prompt[]> {
        return this.repository.findAll({ categoryId: query.categoryId });
    }
}
