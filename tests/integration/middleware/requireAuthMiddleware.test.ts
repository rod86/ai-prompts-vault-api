import { faker } from '@faker-js/faker';
import express, { type Express, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import requireAuthMiddleware from '@src/middleware/requireAuthMiddleware.js';
import { createUserFixture } from '@tests/lib/config.js';
import { createSignedToken } from '@tests/lib/utils.js';

describe('requireAuthMiddleware', () => {
    const userFixture = createUserFixture();

    afterEach(async () => {
        await userFixture.cleanup();
    });

    function buildApp(): Express {
        const app = express();
        app.get('/protected', requireAuthMiddleware, (req: Request, res: Response) => {
            res.status(200).json(req.auth);
        });
        app.use(errorMiddleware);
        return app;
    }

    it('attaches the caller identity for a valid, unexpired token', async () => {
        const fixture = await userFixture.insert();
        const token = createSignedToken({ sub: fixture.id });
        const app = buildApp();

        const response = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ userId: fixture.id });
    });

    it('rejects a token whose user id matches no existing account', async () => {
        const token = createSignedToken({ sub: faker.string.uuid() });
        const app = buildApp();

        const response = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
    });

    it('rejects a request with no Authorization header', async () => {
        const app = buildApp();

        const response = await request(app).get('/protected');

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ status: 401, code: 'MISSING_TOKEN' });
    });

    it('rejects an expired token, telling the caller it expired', async () => {
        const token = createSignedToken({ sub: 'fixture-user-id', expiresInSeconds: -10 });
        const app = buildApp();

        const response = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
    });

    it('rejects a token signed with a different secret', async () => {
        const token = createSignedToken({ sub: 'fixture-user-id', secret: 'a-different-secret' });
        const app = buildApp();

        const response = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
    });
});
