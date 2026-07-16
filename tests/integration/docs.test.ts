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

    it('documents the health and authentication endpoints with exactly their real outcomes', async () => {
        const response = await request(app).get('/openapi.json');

        expect(Object.keys(response.body.paths['/health'].get.responses).sort()).toEqual([
            '200',
            '429',
        ]);
        expect(Object.keys(response.body.paths['/authenticate'].post.responses).sort()).toEqual([
            '200',
            '400',
            '401',
            '429',
        ]);
    });

    it('documents user registration with exactly its real outcomes', async () => {
        const response = await request(app).get('/openapi.json');

        expect(Object.keys(response.body.paths['/users'].post.responses).sort()).toEqual([
            '201',
            '400',
            '422',
            '429',
        ]);
    });
});
