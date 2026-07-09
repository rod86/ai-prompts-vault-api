import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';

export type DeletePromptQuery = {
    id: string;
};

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
