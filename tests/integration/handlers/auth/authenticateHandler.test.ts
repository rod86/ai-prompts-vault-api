import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import {
    databaseClient,
    passwordHasher,
    type DatabaseSchema,
} from '@src/modules/shared/services.js';
import { userModelFactory } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';

describe('POST /authenticate', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    const createdIds: string[] = [];

    const knownPassword = 'a-secure-password';
    const knownUser = userModelFactory.create({ email: 'ada.lovelace@example.com' });

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();

        knownUser.passwordHash = await passwordHasher.hash(knownPassword);
        await insertUsers(db, [knownUser]);
        createdIds.push(knownUser.id);
    });

    afterAll(async () => {
        await deleteUsersByIds(db, createdIds);
        await client.close();
    });

    it('issues a token and returns 200 for valid credentials', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: knownUser.email, password: knownPassword });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ token: expect.any(String) });
        expect(response.body.token).not.toHaveLength(0);
        expect(response.body.password).toBeUndefined();
        expect(Object.keys(response.body)).toEqual(['token']);
    });

    it('returns a 400 validation failure when email is missing', async () => {
        const response = await request(app).post('/authenticate').send({ password: knownPassword });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'RequestValidationError',
            message: 'Request Validation data failed',
            details: { body: { email: expect.any(String) } },
        });
        expect(response.body.details.body.email).not.toHaveLength(0);
        expect(response.body.token).toBeUndefined();
    });

    it('returns a 400 validation failure when password is missing', async () => {
        const response = await request(app).post('/authenticate').send({ email: knownUser.email });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'RequestValidationError',
            message: 'Request Validation data failed',
            details: { body: { password: expect.any(String) } },
        });
        expect(response.body.details.body.password).not.toHaveLength(0);
        expect(response.body.token).toBeUndefined();
    });

    it('returns a 400 validation failure when email is malformed', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: 'not-an-email', password: knownPassword });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('RequestValidationError');
        expect(response.body.details.body.email).toEqual(expect.any(String));
        expect(response.body.details.body.email).not.toHaveLength(0);
        expect(response.body.token).toBeUndefined();
    });

    it('returns a 400 validation failure when password is too short', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: knownUser.email, password: 'abc' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('RequestValidationError');
        expect(response.body.details.body.password).toEqual(expect.any(String));
        expect(response.body.details.body.password).not.toHaveLength(0);
        expect(response.body.token).toBeUndefined();
    });

    it('returns a 401 invalid-credentials failure when the email is unknown', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: 'unknown.user@example.com', password: knownPassword });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            error: 'InvalidCredentialsError',
            message: 'Invalid authentication credentials',
        });
        expect(response.body.token).toBeUndefined();
    });

    it('returns a 401 invalid-credentials failure identical to the unknown-email case when the password is wrong', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: knownUser.email, password: 'wrong-password' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            error: 'InvalidCredentialsError',
            message: 'Invalid authentication credentials',
        });
        expect(response.body.token).toBeUndefined();
    });
});
