export class UserCreationError extends Error {
    constructor(id: string, cause: unknown) {
        super(`Failed to create user: ${id}`, { cause });
        this.name = 'UserCreationError';
    }
}
