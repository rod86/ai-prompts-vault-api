import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';

export interface DeletePromptQuery {
    id: string;
}

export class DeletePromptUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: DeletePromptQuery): Promise<void> {
        const prompt = await this.repository.findById(query.id);

        if (!prompt) {
            throw new PromptNotFoundError(query.id);
        }

        await this.repository.delete(query.id);
    }
}
