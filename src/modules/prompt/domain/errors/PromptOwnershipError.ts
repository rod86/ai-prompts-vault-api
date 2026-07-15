export class PromptOwnershipError extends Error {
    constructor(id: string) {
        super(`You are not allowed to modify or delete this prompt: ${id}`);
        this.name = 'PromptOwnershipError';
    }
}
