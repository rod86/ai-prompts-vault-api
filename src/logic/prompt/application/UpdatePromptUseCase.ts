import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt, type UpdatePrompt } from '@logic/prompt/domain/Prompt.js';

export interface UpdatePromptQuery {
    id: string;
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
    updatedAt: Date;
}

export class UpdatePromptUseCase {
    constructor(
        private readonly promptRepository: PromptRepositoryInterface,
        private readonly categoryRepository: PromptCategoryRepositoryInterface,
    ) {}

    public async invoke(query: UpdatePromptQuery): Promise<Prompt> {
        const existingPrompt = await this.promptRepository.findById(query.id);

        if (!existingPrompt) {
            throw new PromptNotFoundError(query.id);
        }

        const category = await this.categoryRepository.findById(query.categoryId);

        if (!category) {
            throw new CategoryNotFoundError(query.categoryId);
        }

        const updatePrompt: UpdatePrompt = {
            categoryId: query.categoryId,
            title: query.title,
            prompt: query.prompt,
            description: query.description ?? null,
            updatedAt: query.updatedAt,
        };

        await this.promptRepository.update(query.id, updatePrompt);

        return {
            id: query.id,
            category,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: existingPrompt.createdAt,
            updatedAt: query.updatedAt,
        };
    }
}
