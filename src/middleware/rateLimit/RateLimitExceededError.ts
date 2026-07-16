export class RateLimitExceededError extends Error {
    constructor() {
        super('Too many requests, please try again later.');
        this.name = 'RateLimitExceededError';
    }
}
