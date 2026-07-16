import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class RateLimitExceededError extends DomainError {
    readonly code = 'TOO_MANY_REQUESTS';
    readonly category: ErrorCategory = 'TooManyRequests';

    constructor() {
        super('Too many requests, please try again later.');
    }
}
