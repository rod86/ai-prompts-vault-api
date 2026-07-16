import { describe, expect, it } from 'vitest';
import { CATEGORY_STATUS } from '@src/middleware/domainErrorStatus.js';

describe('CATEGORY_STATUS', () => {
    it('maps each error category to its HTTP status', () => {
        expect(CATEGORY_STATUS).toEqual({
            NotFound: 404,
            Forbidden: 403,
            Unauthorized: 401,
            Unprocessable: 422,
            TooManyRequests: 429,
        });
    });
});
