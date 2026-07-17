import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';
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
});
