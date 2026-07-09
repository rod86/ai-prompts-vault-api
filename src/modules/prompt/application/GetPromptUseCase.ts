import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';

export type GetPromptQuery = {
    id: string;
};

export class GetPromptUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: GetPromptQuery): Promise<Prompt> {
        const prompt = await this.repository.findById(query.id);

        if (!prompt) {
            throw new PromptNotFoundError(query.id);
        }

        return prompt;
    }
}
