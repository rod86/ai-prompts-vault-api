export class PromptCreationError extends Error {
    constructor(id: string, cause: unknown) {
        super(`Failed to create prompt: ${id}`, { cause });
        this.name = 'PromptCreationError';
    }
}
