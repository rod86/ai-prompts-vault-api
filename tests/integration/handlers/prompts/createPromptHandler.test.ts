import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import { prompts } from '@src/modules/prompt/infrastructure/database/schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient, type DatabaseSchema } from '@src/modules/shared/services.js';
import { promptCategoryModelFactory, userModelFactory } from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import { deletePromptsByIds, selectPromptsByIds } from '@tests/lib/database/prompts.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';

describe('POST /prompts', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    const creatorUser = userModelFactory.create();
    let authToken: string;

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
        await insertUsers(db, [creatorUser]);
        authToken = jwt.sign(
            { sub: creatorUser.id, exp: Math.floor(Date.now() / 1000) + 3600 },
            config.jwtSecret,
            { algorithm: 'HS256' },
        );
    });

    afterAll(async () => {
        await deleteUsersByIds(db, [creatorUser.id]);
        await client.close();
    });

    it('rejects a request with no Authorization header and creates no prompt', async () => {
        const category = promptCategoryModelFactory.create();
        await insertPromptCategories(db, [category]);
        const body = {
            title: 'My prompt title',
            prompt: 'My prompt text',
            category_id: category.id,
        };

        const response = await request(app).post('/prompts').send(body);

        expect(response.status).toBe(401);
        const stored = await db.select().from(prompts).where(eq(prompts.promptCategoryId, category.id));
        expect(stored).toEqual([]);

        await deletePromptCategoriesByIds(db, [category.id]);
    });

    describe('when the category exists', () => {
        const category = promptCategoryModelFactory.create();

        beforeAll(async () => {
            await insertPromptCategories(db, [category]);
        });

        afterAll(async () => {
            await deletePromptCategoriesByIds(db, [category.id]);
        });

        it('creates a prompt and returns 201 with the stored prompt', async () => {
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
                description: 'My prompt description',
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            expect(response.status).toBe(201);
            expect(response.body).toEqual({
                id: expect.any(String),
                title: body.title,
                prompt: body.prompt,
                description: body.description,
                category: { id: category.id, name: category.name },
                created_at: expect.any(String),
                updated_at: expect.any(String),
            });
            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted).toMatchObject({
                id: response.body.id,
                promptCategoryId: category.id,
                title: body.title,
                prompt: body.prompt,
                description: body.description,
            });

            await deletePromptsByIds(db, [response.body.id]);
        });

        it('returns description: null and stores it as null when not submitted', async () => {
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            expect(response.body.description).toBeNull();

            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted?.description).toBeNull();

            await deletePromptsByIds(db, [response.body.id]);
        });

        it('returns description: null and stores it as empty text when submitted as empty', async () => {
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
                description: '',
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            expect(response.body.description).toBeNull();

            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted?.description).toBe('');

            await deletePromptsByIds(db, [response.body.id]);
        });
    });

    it('returns a category-invalid error when category_id matches no category', async () => {
        const unknownCategoryId = faker.string.uuid();
        const body = {
            title: 'My prompt title',
            prompt: 'My prompt text',
            category_id: unknownCategoryId,
        };

        const response = await request(app)
            .post('/prompts')
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            error: 'CategoryNotFoundError',
            message: `Category not found: ${unknownCategoryId}`,
        });

        const stored = await db
            .select()
            .from(prompts)
            .where(eq(prompts.promptCategoryId, unknownCategoryId));
        expect(stored).toEqual([]);
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required fields', async () => {
            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(response.body.details.body).toEqual({
                title: 'Missing required value',
                prompt: 'Missing required value',
                category_id: 'Missing required value',
            });
        });

        it('returns an invalid value error for a non-uuid category_id', async () => {
            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    category_id: '12345',
                });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ category_id: 'Invalid UUID value' }),
            );
        });
    });
});
