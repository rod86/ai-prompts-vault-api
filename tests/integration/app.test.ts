import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';

describe('app', () => {
    it('responds with the not-found contract on an unknown path', async () => {
        const response = await request(app).get('/does-not-exist');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Cannot GET /does-not-exist',
        });
    });
});
