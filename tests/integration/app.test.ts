import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';

describe('app', () => {
    it('responds with ok on the health check endpoint', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });
});
