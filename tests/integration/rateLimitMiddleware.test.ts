import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';

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

    it('rejects a request once the allowance is exhausted with the E1 envelope', async () => {
        let response;

        for (let i = 0; i < config.rateLimit.max + 1; i++) {
            response = await request(app).get('/does-not-exist');
        }

        expect(response?.status).toBe(429);
        expect(response?.body).toEqual({
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later.',
        });
        expect(response?.headers['retry-after']).toBeDefined();
    });

    it('rejects the health check like any other endpoint once exhausted', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(429);
        expect(response.body).toEqual({
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later.',
        });
    });

    it('holds independent allowances per forwarded client behind a trusted proxy', async () => {
        let exhaustedResponse;

        for (let i = 0; i < config.rateLimit.max + 1; i++) {
            exhaustedResponse = await request(app)
                .get('/does-not-exist')
                .set('X-Forwarded-For', '10.1.1.1');
        }

        expect(exhaustedResponse?.status).toBe(429);

        const otherClientResponse = await request(app)
            .get('/does-not-exist')
            .set('X-Forwarded-For', '10.2.2.2');

        expect(otherClientResponse.status).toBe(404);
    });
});
