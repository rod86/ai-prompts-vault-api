export class TokenExpiredError extends Error {
    constructor() {
        super('Authentication token has expired');
        this.name = 'TokenExpiredError';
    }
}
