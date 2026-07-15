import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import { PromptOwnershipError } from '@src/modules/prompt/domain/errors/PromptOwnershipError.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';

export type DeletePromptQuery = {
    id: string;
    userId: string;
};

export class DeletePromptUseCase {
    constructor(private readonly repository: PromptRepositoryInterface) {}

    public async invoke(query: DeletePromptQuery): Promise<void> {
        const prompt = await this.repository.findById(query.id);

        if (!prompt) {
            throw new PromptNotFoundError(query.id);
        }

        if (prompt.user.id !== query.userId) {
            throw new PromptOwnershipError(query.id);
        }

        await this.repository.delete(query.id);
    }
}
