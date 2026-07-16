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

    it('documents the prompt endpoints with exactly their real outcomes and bearer security', async () => {
        const response = await request(app).get('/openapi.json');
        const { paths, components } = response.body;

        expect(Object.keys(paths['/prompt-categories'].get.responses).sort()).toEqual([
            '200',
            '429',
        ]);
        expect(Object.keys(paths['/prompts'].post.responses).sort()).toEqual([
            '201',
            '400',
            '401',
            '422',
            '429',
        ]);
        expect(Object.keys(paths['/prompts/{id}'].put.responses).sort()).toEqual([
            '200',
            '400',
            '401',
            '403',
            '404',
            '422',
            '429',
        ]);
        expect(Object.keys(paths['/prompts/{id}'].delete.responses).sort()).toEqual([
            '204',
            '400',
            '401',
            '403',
            '404',
            '429',
        ]);

        expect(components.securitySchemes.bearerAuth).toBeDefined();
        expect(paths['/prompts'].post.security).toEqual([{ bearerAuth: [] }]);
        expect(paths['/prompts/{id}'].put.security).toEqual([{ bearerAuth: [] }]);
        expect(paths['/prompts/{id}'].delete.security).toEqual([{ bearerAuth: [] }]);
    });
});

describe('GET /logo.png', () => {
    it('serves the public icon file as-is', async () => {
        const response = await request(app).get('/logo.png');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('image/png');
    });
});

describe('GET /docs/', () => {
    it('serves the documentation page referencing the description document and the icon', async () => {
        const response = await request(app).get('/docs/');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/text\/html/);
        expect(response.text).toContain('/openapi.json');
        expect(response.text).toContain('/logo.png');
    });
});

describe('Documentation surface rate-limit exemption', () => {
    it('carries no allowance information for the docs page and description document, unlike a normal endpoint', async () => {
        const clientIp = '10.9.9.9';

        const openApiResponse = await request(app)
            .get('/openapi.json')
            .set('X-Forwarded-For', clientIp);
        const docsResponse = await request(app).get('/docs/').set('X-Forwarded-For', clientIp);
        const healthResponse = await request(app).get('/health').set('X-Forwarded-For', clientIp);

        expect(openApiResponse.headers['ratelimit']).toBeUndefined();
        expect(docsResponse.headers['ratelimit']).toBeUndefined();
        expect(healthResponse.headers['ratelimit']).toBeDefined();
    });
});
