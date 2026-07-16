import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';

describe('rate limit middleware', () => {
    it('serves the request normally and carries the allowance state headers', async () => {
        const response = await request(app).get('/does-not-exist');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Cannot GET /does-not-exist',
        });
        expect(response.headers['ratelimit-policy']).toBeDefined();
        expect(response.headers['ratelimit']).toBeDefined();
    });
});
