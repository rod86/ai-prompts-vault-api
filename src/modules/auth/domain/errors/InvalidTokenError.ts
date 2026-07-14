export class InvalidTokenError extends Error {
    constructor() {
        super('Authentication token is invalid');
        this.name = 'InvalidTokenError';
    }
}
