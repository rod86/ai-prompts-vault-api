import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import { HealthResponseSchema } from '@src/routes/health/health.response.schema.js';

describe('GET /health', () => {
    it('returns 200 with a healthy status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });

    it('response matches the documented shape', async () => {
        const response = await request(app).get('/health');

        expect(() => HealthResponseSchema.parse(response.body)).not.toThrow();
    });

    it('rejects the request once the general request-rate allowance is exhausted', async () => {
        const clientIp = '10.20.0.1';
        let response;

        for (let i = 0; i < config.rateLimit.max + 1; i++) {
            response = await request(app).get('/health').set('X-Forwarded-For', clientIp);
        }

        expect(response?.status).toBe(429);
        expect(response?.body).toEqual({
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later.',
        });
    });
});
