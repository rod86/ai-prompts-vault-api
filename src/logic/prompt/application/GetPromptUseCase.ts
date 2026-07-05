import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';

export interface GetPromptQuery {
    id: string;
}

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
