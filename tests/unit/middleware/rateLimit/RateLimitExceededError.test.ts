import { describe, expect, it } from 'vitest';
import { DomainError } from '@src/modules/shared/domain/DomainError.js';
import { RateLimitExceededError } from '@src/middleware/rateLimit/RateLimitExceededError.js';

describe('RateLimitExceededError', () => {
    it('carries the rate-limit code, category, and message', () => {
        const error = new RateLimitExceededError();

        expect(error).toBeInstanceOf(DomainError);
        expect(error.code).toBe('TOO_MANY_REQUESTS');
        expect(error.category).toBe('TooManyRequests');
        expect(error.message).toBe('Too many requests, please try again later.');
    });
});
