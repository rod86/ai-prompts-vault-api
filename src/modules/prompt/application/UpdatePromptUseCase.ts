import { CategoryNotFoundError } from '@src/modules/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import { PromptUpdateError } from '@src/modules/prompt/domain/errors/PromptUpdateError.js';
import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt, type UpdatePrompt } from '@src/modules/prompt/domain/Prompt.js';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';

export type UpdatePromptQuery = {
    id: string;
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
};

export class UpdatePromptUseCase {
    constructor(
        private readonly promptRepository: PromptRepositoryInterface,
        private readonly categoryRepository: PromptCategoryRepositoryInterface,
        private readonly dateTime: DateTimeInterface,
    ) {}

    public async invoke(query: UpdatePromptQuery): Promise<Prompt> {
        const existingPrompt = await this.promptRepository.findById(query.id);

        if (!existingPrompt) {
            throw new PromptNotFoundError(query.id);
        }

        const category =
            query.categoryId === existingPrompt.category.id
                ? existingPrompt.category
                : await this.categoryRepository.findById(query.categoryId);

        if (!category) {
            throw new CategoryNotFoundError(query.categoryId);
        }

        const updatedAt = this.dateTime.now();
        const updatePrompt: UpdatePrompt = {
            categoryId: query.categoryId,
            title: query.title,
            prompt: query.prompt,
            description: query.description ?? null,
            updatedAt,
        };

        try {
            await this.promptRepository.update(query.id, updatePrompt);
        } catch (error) {
            throw new PromptUpdateError(query.id, error);
        }

        return {
            id: query.id,
            category,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: existingPrompt.createdAt,
            updatedAt,
        };
    }
}
