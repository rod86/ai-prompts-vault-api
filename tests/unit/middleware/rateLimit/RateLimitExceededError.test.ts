import { describe, expect, it } from 'vitest';
import { RateLimitExceededError } from '@src/middleware/rateLimit/RateLimitExceededError.js';

describe('RateLimitExceededError', () => {
    it('carries the rate-limit message', () => {
        const error = new RateLimitExceededError();

        expect(error).toBeInstanceOf(RateLimitExceededError);
        expect(error.message).toBe('Too many requests, please try again later.');
    });
});