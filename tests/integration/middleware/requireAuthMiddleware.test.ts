import { faker } from '@faker-js/faker';
import express, { type Express, type Request, type Response } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import requireAuthMiddleware from '@src/middleware/requireAuthMiddleware.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient, type DatabaseSchema } from '@src/modules/shared/services.js';
import { userModelFactory } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';
import { createSignedToken } from '@tests/lib/utils.js';

describe('requireAuthMiddleware', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    let insertedIds: string[] = [];

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
    });

    afterEach(async () => {
        await deleteUsersByIds(db, insertedIds);
        insertedIds = [];
    });

    afterAll(async () => {
        await client.close();
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
        const fixture = userModelFactory.create();
        insertedIds = [fixture.id];
        await insertUsers(db, [fixture]);
        const token = createSignedToken({ sub: fixture.id });
        const app = buildApp();

        const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ userId: fixture.id });
    });

    it('rejects a token whose user id matches no existing account', async () => {
        const token = createSignedToken({ sub: faker.string.uuid() });
        const app = buildApp();

        const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ error: 'InvalidTokenError' });
    });

    it('rejects a request with no Authorization header', async () => {
        const app = buildApp();

        const response = await request(app).get('/protected');

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ error: 'MissingTokenError' });
    });

    it('rejects an expired token, telling the caller it expired', async () => {
        const token = createSignedToken({ sub: 'fixture-user-id', expiresInSeconds: -10 });
        const app = buildApp();

        const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ error: 'TokenExpiredError' });
    });

    it('rejects a token signed with a different secret', async () => {
        const token = createSignedToken({ sub: 'fixture-user-id', secret: 'a-different-secret' });
        const app = buildApp();

        const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ error: 'InvalidTokenError' });
    });
});
