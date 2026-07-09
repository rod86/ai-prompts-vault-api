export class PromptUpdateError extends Error {
    constructor(id: string, cause: unknown) {
        super(`Failed to update prompt: ${id}`, { cause });
        this.name = 'PromptUpdateError';
    }
}
