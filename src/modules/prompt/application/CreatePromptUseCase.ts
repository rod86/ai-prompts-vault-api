import { CategoryNotFoundError } from '@src/modules/prompt/domain/errors/CategoryNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import type IdGeneratorInterface from '@src/modules/shared/domain/interfaces/IdGeneratorInterface.js';

export type CreatePromptQuery = {
    title: string;
    prompt: string;
    categoryId: string;
    description?: string;
};

export class CreatePromptUseCase {
    constructor(
        private readonly promptRepository: PromptRepositoryInterface,
        private readonly categoryRepository: PromptCategoryRepositoryInterface,
        private readonly dateTime: DateTimeInterface,
        private readonly idGenerator: IdGeneratorInterface,
    ) {}

    public async invoke(query: CreatePromptQuery): Promise<Prompt> {
        const category = await this.categoryRepository.findById(query.categoryId);

        if (!category) {
            throw new CategoryNotFoundError(query.categoryId);
        }

        const now = this.dateTime.now();
        const common = {
            id: this.idGenerator.generate(),
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: now,
            updatedAt: now,
        };

        await this.promptRepository.create({ ...common, categoryId: category.id });

        return { ...common, category };
    }
}
