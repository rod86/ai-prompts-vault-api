import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import { passwordHasher } from '@src/modules/shared/services.js';
import { type User } from '@src/modules/user/domain/User.js';
import { createUserFixture } from '@tests/lib/config.js';

describe('login rate limit middleware', () => {
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

    it('rejects further attempts with E1 once the failed-attempt allowance is exhausted, even with correct credentials', async () => {
        const clientIp = '10.10.0.1';
        let response;

        for (let i = 0; i < config.loginRateLimit.max; i++) {
            response = await request(app)
                .post('/authenticate')
                .set('X-Forwarded-For', clientIp)
                .send({ email: knownUser.email, password: 'wrong-password' });
        }

        response = await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', clientIp)
            .send({ email: knownUser.email, password: knownPassword });

        expect(response.status).toBe(429);
        expect(response.body).toEqual({
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later.',
        });
        expect(response.headers['retry-after']).toBeDefined();
    });

    it('never consumes the allowance on successful logins', async () => {
        const clientIp = '10.10.0.2';
        let response;

        for (let i = 0; i < config.loginRateLimit.max + 1; i++) {
            response = await request(app)
                .post('/authenticate')
                .set('X-Forwarded-For', clientIp)
                .send({ email: knownUser.email, password: knownPassword });
        }

        expect(response?.status).toBe(200);
        expect(response?.body).toEqual({ token: expect.any(String) });
    });

    it('authenticates normally when the client has fewer failed attempts than its allowance', async () => {
        const clientIp = '10.10.0.3';

        for (let i = 0; i < config.loginRateLimit.max - 1; i++) {
            await request(app)
                .post('/authenticate')
                .set('X-Forwarded-For', clientIp)
                .send({ email: knownUser.email, password: 'wrong-password' });
        }

        const response = await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', clientIp)
            .send({ email: knownUser.email, password: knownPassword });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ token: expect.any(String) });
    });

    it('rejects with E1 when a success interleaved with failures did not clear the counted failures', async () => {
        const clientIp = '10.10.0.4';

        for (let i = 0; i < config.loginRateLimit.max - 1; i++) {
            await request(app)
                .post('/authenticate')
                .set('X-Forwarded-For', clientIp)
                .send({ email: knownUser.email, password: 'wrong-password' });
        }

        const successResponse = await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', clientIp)
            .send({ email: knownUser.email, password: knownPassword });

        expect(successResponse.status).toBe(200);

        await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', clientIp)
            .send({ email: knownUser.email, password: 'wrong-password' });

        const response = await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', clientIp)
            .send({ email: knownUser.email, password: knownPassword });

        expect(response.status).toBe(429);
        expect(response.body).toEqual({
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later.',
        });
    });

    it('holds independent login allowances per client', async () => {
        const lockedClientIp = '10.10.0.5';
        const otherClientIp = '10.10.0.6';

        for (let i = 0; i < config.loginRateLimit.max; i++) {
            await request(app)
                .post('/authenticate')
                .set('X-Forwarded-For', lockedClientIp)
                .send({ email: knownUser.email, password: 'wrong-password' });
        }

        const lockedResponse = await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', lockedClientIp)
            .send({ email: knownUser.email, password: knownPassword });

        expect(lockedResponse.status).toBe(429);

        const otherResponse = await request(app)
            .post('/authenticate')
            .set('X-Forwarded-For', otherClientIp)
            .send({ email: knownUser.email, password: knownPassword });

        expect(otherResponse.status).toBe(200);
        expect(otherResponse.body).toEqual({ token: expect.any(String) });
    });
});
