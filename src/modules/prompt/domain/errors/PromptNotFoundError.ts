export class PromptNotFoundError extends Error {
    constructor(id: string) {
        super(`Prompt not found: ${id}`);
        this.name = 'PromptNotFoundError';
    }
}
