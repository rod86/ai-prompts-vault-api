import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '@src/app.js';

describe('GET /openapi.json', () => {
    it('returns the OpenAPI description document', async () => {
        const response = await request(app).get('/openapi.json');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body.openapi).toMatch(/^3\.1/);
        expect(response.body.info).toEqual(
            expect.objectContaining({
                title: 'AI Prompts Vault API',
                version: '0.1.0',
            }),
        );
    });
});
