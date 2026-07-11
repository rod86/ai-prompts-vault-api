import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';

describe('app', () => {
    it('responds with ok on the health check endpoint', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });

    it('responds with the not-found contract on an unknown path', async () => {
        const response = await request(app).get('/does-not-exist');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: 'NotFound',
            message: 'Cannot GET /does-not-exist',
        });
    });
});
