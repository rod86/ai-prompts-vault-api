import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '@logic/shared/infrastructure/security/BcryptPasswordHasher.js';
import app from '@src/app.js';
import config from '@src/config.js';
import { databaseClient, userModelFactory, type TestDatabaseConnection } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';

describe('POST /authenticate', () => {
    let db: TestDatabaseConnection;
    let insertedIds: string[] = [];

    beforeAll(() => {
        db = databaseClient.connect();
    });

    afterEach(async () => {
        await deleteUsersByIds(db, insertedIds);
        insertedIds = [];
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    it('issues a token for valid credentials, matching email case-insensitively', async () => {
        const plainPassword = 'Sup3r$ecret!';
        const passwordHash = await new BcryptPasswordHasher().hash(plainPassword);
        const fixture = userModelFactory.create({
            email: 'Login.Fixture@Example.com',
            passwordHash,
        });
        insertedIds = [fixture.id];
        await insertUsers(db, [fixture]);

        const response = await request(app)
            .post('/authenticate')
            .send({ email: 'login.fixture@example.com', password: plainPassword });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ token: expect.any(String) });
        const decoded = jwt.verify(response.body.token, config.jwtSecret) as { sub: string; iat: number; exp: number };
        expect(decoded.sub).toBe(fixture.id);
        expect(decoded.exp - decoded.iat).toBe(config.jwtExpirationSeconds);
    });

    it('returns an invalid-credentials error for an unknown email', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: faker.internet.email(), password: 'any-password' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid authentication credentials' });
    });

    it('returns an invalid-credentials error for a wrong password on an existing account', async () => {
        const passwordHash = await new BcryptPasswordHasher().hash('Sup3r$ecret!');
        const fixture = userModelFactory.create({ passwordHash });
        insertedIds = [fixture.id];
        await insertUsers(db, [fixture]);

        const response = await request(app)
            .post('/authenticate')
            .send({ email: fixture.email, password: 'a-completely-wrong-password' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid authentication credentials' });
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required fields', async () => {
            const response = await request(app).post('/authenticate').send({});

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.email', error: 'Missing required value' },
                    { field: 'body.password', error: 'Missing required value' },
                ]),
            });
        });
    });
});
