import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { UserResponseSchema } from '@src/routes/users.response.schema.js';
import {
    createUserFixture,
    databaseClient,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import { selectUsersByEmail, selectUsersByIds } from '@tests/lib/database/users.js';

describe('POST /users', () => {
    const userFixture = createUserFixture();
    let db: TestDatabaseConnection;

    beforeAll(() => {
        db = databaseClient.getConnection();
    });

    afterEach(async () => {
        await userFixture.cleanup();
    });

    it('creates a user and returns 201 with the stored user', async () => {
        const body = {
            name: 'Ada Lovelace',
            email: 'ada.lovelace@example.com',
            password: 'Xk9$mQr7vTz#Lp2w',
        };

        const response = await request(app).post('/users').send(body);
        userFixture.register(response.body.id);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            id: expect.any(String),
            name: body.name,
            email: body.email,
            created_at: expect.any(String),
            updated_at: expect.any(String),
        });

        const [persisted] = await selectUsersByIds(db, [response.body.id]);
        expect(persisted).toMatchObject({
            id: response.body.id,
            name: body.name,
            email: body.email,
        });
        expect(persisted?.passwordHash).toBeTruthy();
        expect(persisted?.passwordHash).not.toBe(body.password);
    });

    it('response matches the documented shape', async () => {
        const body = {
            name: 'Grace Hopper',
            email: 'grace.hopper@example.com',
            password: 'Xk9$mQr7vTz#Lp2w',
        };

        const response = await request(app).post('/users').send(body);
        userFixture.register(response.body.id);

        expect(() => UserResponseSchema.parse(response.body)).not.toThrow();
    });

    it('returns a 422 email-already-in-use failure when the email is already used', async () => {
        const existingUser = await userFixture.insert();

        const body = {
            name: 'Margaret Hamilton',
            email: existingUser.email,
            password: 'Xk9$mQr7vTz#Lp2w',
        };

        const response = await request(app).post('/users').send(body);

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            status: 422,
            code: 'EMAIL_ALREADY_IN_USE',
            message: `Email already in use: ${existingUser.email}`,
        });

        const stored = await selectUsersByEmail(db, existingUser.email);
        expect(stored).toHaveLength(1);
        expect(stored[0]?.id).toBe(existingUser.id);
    });

    it('returns a 422 weak-password failure for a well-formed but easily guessed password', async () => {
        const body = {
            name: 'Alan Turing',
            email: 'alan.turing@example.com',
            password: 'Qwerty123!',
        };

        const response = await request(app).post('/users').send(body);

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            status: 422,
            code: 'WEAK_PASSWORD',
            message: 'Password is too weak',
        });

        const stored = await selectUsersByEmail(db, body.email);
        expect(stored).toHaveLength(0);
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required body fields', async () => {
            const response = await request(app).post('/users').send({});

            expect(response.body.details.body).toEqual({
                name: 'Missing required value',
                email: 'Missing required value',
                password: 'Missing required value',
            });
        });

        it('returns an invalid value error for a malformed email', async () => {
            const response = await request(app).post('/users').send({
                email: 'not-an-email',
            });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ email: 'Invalid email value' }),
            );
        });

        it('returns an invalid value error for a too-short password', async () => {
            const response = await request(app).post('/users').send({
                password: 'abc',
            });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ password: 'Must be at least 8 characters' }),
            );
        });

        it.each([
            ['abc', 'Must be at least 8 characters'],
            [`Aa1!${'a'.repeat(61)}`, 'Must be at most 64 characters'],
            ['AA11!!!!', 'Must contain at least one lowercase letter'],
            ['aa11!!!!', 'Must contain at least one uppercase letter'],
            ['AAaa!!!!', 'Must contain at least one digit'],
            ['AAaa1111', 'Must contain at least one special character'],
            ['Pàssword1!', 'Must contain only letters, digits, and allowed special characters'],
            ['Password 1!', 'Must contain only letters, digits, and allowed special characters'],
        ])('returns "%s" -> %s for the password composition rule', async (password, expectedMessage) => {
            const response = await request(app).post('/users').send({ password });

            expect(response.status).toBe(400);
            expect(response.body.details.body.password).toBe(expectedMessage);
        });
    });
});
