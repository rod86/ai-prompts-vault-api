import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { passwordHasher } from '@src/modules/shared/services.js';
import { type User } from '@src/modules/user/domain/User.js';
import { AuthenticateResponseSchema } from '@src/routes/auth.response.schema.js';
import { createUserFixture } from '@tests/lib/config.js';

describe('POST /authenticate', () => {
    const userFixture = createUserFixture();
    const knownPassword = 'a-secure-password';
    let knownUser: User;

    beforeAll(async () => {
        knownUser = await userFixture.insert({
            passwordHash: await passwordHasher.hash(knownPassword),
        });
    });

    afterAll(async () => {
        await userFixture.cleanup();
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

    it('response matches the documented shape', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: knownUser.email, password: knownPassword });

        expect(() => AuthenticateResponseSchema.parse(response.body)).not.toThrow();
    });

    it('returns a 401 invalid-credentials failure when the email is unknown', async () => {
        const response = await request(app)
            .post('/authenticate')
            .send({ email: 'unknown.user@example.com', password: knownPassword });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            status: 401,
            code: 'INVALID_CREDENTIALS',
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
            status: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid authentication credentials',
        });
        expect(response.body.token).toBeUndefined();
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required body fields', async () => {
            const response = await request(app).post('/authenticate').send({});

            expect(response.body.details.body).toEqual({
                email: 'Missing required value',
                password: 'Missing required value',
            });
        });

        it('returns an invalid value error for a malformed email', async () => {
            const response = await request(app).post('/authenticate').send({
                email: 'not-an-email',
            });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ email: 'Invalid email value' }),
            );
        });

        it('returns an invalid value error for a too-short password', async () => {
            const response = await request(app).post('/authenticate').send({
                password: 'abc',
            });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ password: 'Must be at least 8 characters' }),
            );
        });
    });
});
