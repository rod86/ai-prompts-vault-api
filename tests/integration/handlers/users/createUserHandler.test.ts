import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { users } from '@src/modules/user/infrastructure/database/schema.js';
import { databaseClient, type DatabaseSchema } from '@src/modules/shared/services.js';
import { deleteUsersByIds, selectUsersByIds } from '@tests/lib/database/users.js';

describe('POST /users', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    let createdIds: string[] = [];

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
    });

    afterEach(async () => {
        await deleteUsersByIds(db, createdIds);
        createdIds = [];
    });

    afterAll(async () => {
        await client.close();
    });

    it('creates a user and returns 201 with the stored user', async () => {
        const body = {
            name: 'Ada Lovelace',
            email: 'ada.lovelace@example.com',
            password: 'a-secure-password',
        };

        const response = await request(app).post('/users').send(body);
        createdIds.push(response.body.id);

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

    it('returns a 400 validation failure when a required field is missing', async () => {
        const body = {
            email: 'missing.name@example.com',
            password: 'a-secure-password',
        };

        const response = await request(app).post('/users').send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'RequestValidationError',
            message: 'Request Validation data failed',
            details: { body: { name: expect.any(String) } },
        });

        const stored = await db.select().from(users).where(eq(users.email, body.email));
        expect(stored).toEqual([]);
    });
});
