import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import {
    databaseClient,
    promptCategoryModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';
import { deletePromptsByIds } from '@tests/lib/seeding/prompts.js';

describe('POST /prompts', () => {
    let db: TestDatabaseConnection;
    const fixtureCategory = promptCategoryModelFactory.create({
        name: 'Create Prompt Fixture Category',
    });

    beforeAll(async () => {
        db = databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id]);
        await databaseClient.close();
    });

    it('creates and returns the new prompt', async () => {
        const payload = {
            title: 'Fixture title',
            prompt: 'Fixture prompt text',
            description: 'Fixture description',
            category_id: fixtureCategory.id,
        };

        const response = await request(app).post('/prompts').send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            title: payload.title,
            prompt: payload.prompt,
            description: payload.description,
        });
        const body = response.body as { id: string; createdAt: string; updatedAt: string };
        expect(body.id).toBeDefined();
        expect(body.createdAt).toBe(body.updatedAt);

        await deletePromptsByIds(db, [body.id]);
    });

    it('creates a prompt without a description', async () => {
        const payload = {
            title: 'Fixture title without description',
            prompt: 'Fixture prompt text without description',
            category_id: fixtureCategory.id,
        };

        const response = await request(app).post('/prompts').send(payload);

        expect(response.status).toBe(201);
        const body = response.body as { id: string; description?: string };
        expect(body.description).toBeUndefined();
        expect(response.body).toMatchObject({
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            title: payload.title,
            prompt: payload.prompt,
        });

        await deletePromptsByIds(db, [body.id]);
    });

    it('returns a category-invalid error when category_id matches no category', async () => {
        const missingCategoryId = faker.string.uuid();

        const response = await request(app).post('/prompts').send({
            title: 'title',
            prompt: 'prompt',
            category_id: missingCategoryId,
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: `Category not found: ${missingCategoryId}` });
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required fields', async () => {
            const response = await request(app).post('/prompts').send({});

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.title', error: 'Required' },
                    { field: 'body.prompt', error: 'Required' },
                    { field: 'body.category_id', error: 'Required' },
                ]),
            });
        });

        it('returns an invalid value error for a non-uuid category_id', async () => {
            const response = await request(app).post('/prompts').send({
                title: 'title',
                prompt: 'prompt',
                category_id: '12345',
            });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.category_id', error: 'Invalid uuid' },
                ]),
            });
        });
    });
});
