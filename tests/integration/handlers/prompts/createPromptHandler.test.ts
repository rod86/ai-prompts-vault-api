import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import { prompts } from '@src/modules/prompt/infrastructure/database/schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient, type DatabaseSchema } from '@src/modules/shared/services.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import { deletePromptsByIds, selectPromptsByIds } from '@tests/lib/database/prompts.js';

describe('POST /prompts', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
    });

    afterAll(async () => {
        await client.close();
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

            const response = await request(app).post('/prompts').send(body);

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

        it('omits the description key and stores it as null when not submitted', async () => {
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
            };

            const response = await request(app).post('/prompts').send(body);

            expect(response.status).toBe(201);
            expect(response.body).toEqual({
                id: expect.any(String),
                title: body.title,
                prompt: body.prompt,
                category: { id: category.id, name: category.name },
                created_at: expect.any(String),
                updated_at: expect.any(String),
            });

            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted?.description).toBeNull();

            await deletePromptsByIds(db, [response.body.id]);
        });
    });

    describe('when a required field is missing', () => {
        const category = promptCategoryModelFactory.create();

        beforeAll(async () => {
            await insertPromptCategories(db, [category]);
        });

        afterAll(async () => {
            await deletePromptCategoriesByIds(db, [category.id]);
        });

        it('rejects the request as a 400 validation failure and stores nothing', async () => {
            const body = {
                prompt: 'My prompt text',
                category_id: category.id,
            };

            const response = await request(app).post('/prompts').send(body);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('RequestValidationError');
            expect(response.body.message).toBe('Request Validation data failed');
            expect(typeof response.body.details.body.title).toBe('string');
            expect(response.body.details.body.title.length).toBeGreaterThan(0);

            const stored = await db
                .select()
                .from(prompts)
                .where(eq(prompts.promptCategoryId, category.id));
            expect(stored).toEqual([]);
        });
    });

    describe('when category_id is not a well-formed identifier', () => {
        it('rejects the request as a 400 validation failure, not a category-not-found failure', async () => {
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: 'not-a-uuid',
            };

            const response = await request(app).post('/prompts').send(body);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('RequestValidationError');
            expect(typeof response.body.details.body.category_id).toBe('string');
            expect(response.body.details.body.category_id.length).toBeGreaterThan(0);
        });
    });

    describe('when category_id is well-formed but matches no category', () => {
        it('rejects the request as a 422 category-not-found failure and stores nothing', async () => {
            const unknownCategoryId = faker.string.uuid();
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: unknownCategoryId,
            };

            const response = await request(app).post('/prompts').send(body);

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
    });
});
