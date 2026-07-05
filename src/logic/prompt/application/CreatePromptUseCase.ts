import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';

export interface CreatePromptQuery {
    id: string;
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class CreatePromptUseCase {
    constructor(
        private readonly promptRepository: PromptRepositoryInterface,
        private readonly categoryRepository: PromptCategoryRepositoryInterface,
    ) {}

    public async invoke(query: CreatePromptQuery): Promise<Prompt> {
        const category = await this.categoryRepository.findById(query.categoryId);

        if (!category) {
            throw new CategoryNotFoundError(query.categoryId);
        }

        const prompt: Prompt = {
            id: query.id,
            category,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
        };

        await this.promptRepository.create(prompt);

        return prompt;
    }
}
