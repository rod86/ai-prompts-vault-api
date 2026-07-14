export class MissingTokenError extends Error {
    constructor() {
        super('No authentication token was provided');
        this.name = 'MissingTokenError';
    }
}
