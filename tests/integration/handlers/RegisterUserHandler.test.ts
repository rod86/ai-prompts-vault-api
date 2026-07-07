import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { databaseClient, userModelFactory, type TestDatabaseConnection } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers, selectUsersByIds } from '@tests/lib/database/users.js';

describe('POST /users', () => {
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

    it('creates and returns the new account', async () => {
        const payload = {
            name: 'Fixture Name',
            email: `fixture.${faker.string.uuid()}@example.com`,
            password: 'Sup3r$ecret!',
        };

        const response = await request(app).post('/users').send(payload);
        insertedIds = [response.body.id];

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ name: payload.name, email: payload.email });
        expect(response.body.id).toBeDefined();
        expect(response.body.createdAt).toBe(response.body.updatedAt);
        expect(response.body.password).toBeUndefined();
        expect(response.body.passwordHash).toBeUndefined();
    });

    it('creates an account for a mixed-case email with no existing match, preserving its case', async () => {
        const payload = {
            name: 'Fixture Name',
            email: `Fixture.Mixed.Case.${faker.string.uuid()}@Example.com`,
            password: 'Sup3r$ecret!',
        };

        const response = await request(app).post('/users').send(payload);
        insertedIds = [response.body.id];

        expect(response.status).toBe(201);
        expect(response.body.email).toBe(payload.email);
    });

    it('returns an email-already-in-use error when the email already exists, case-insensitively', async () => {
        const existingEmail = `Existing.Fixture.${faker.string.uuid()}@Example.com`;
        const existingUser = userModelFactory.create({ email: existingEmail });
        insertedIds = [existingUser.id];
        await insertUsers(db, [existingUser]);
        const lowerCasedEmail = existingEmail.toLowerCase();

        const response = await request(app)
            .post('/users')
            .send({ name: 'Another Name', email: lowerCasedEmail, password: 'Sup3r$ecret!' });

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: `Email already in use: ${lowerCasedEmail}` });

        const rows = await selectUsersByIds(db, [existingUser.id]);
        expect(rows).toHaveLength(1);
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required fields', async () => {
            const response = await request(app).post('/users').send({});

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.name', error: 'Missing required value' },
                    { field: 'body.email', error: 'Missing required value' },
                    { field: 'body.password', error: 'Missing required value' },
                ]),
            });
        });

        it('returns a missing-value error for a blank name', async () => {
            const response = await request(app).post('/users').send({
                name: '   ',
                email: 'blank.name.fixture@example.com',
                password: 'Sup3r$ecret!',
            });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.name', error: 'Missing required value' },
                ]),
            });
        });

        it('returns an invalid-value error for a malformed email', async () => {
            const response = await request(app).post('/users').send({
                name: 'Fixture Name',
                email: 'not-an-email',
                password: 'Sup3r$ecret!',
            });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.email', error: 'Invalid email address' },
                ]),
            });
        });

        it('returns a requirement error for a weak password', async () => {
            const response = await request(app).post('/users').send({
                name: 'Fixture Name',
                email: 'weak.password.fixture@example.com',
                password: 'short',
            });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    {
                        field: 'body.password',
                        error:
                            'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a digit, and a special character.',
                    },
                ]),
            });
        });
    });
});
