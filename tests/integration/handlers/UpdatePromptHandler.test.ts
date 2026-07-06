import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import {
    databaseClient,
    promptCategoryModelFactory,
    promptModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import {
    deletePromptsByIds,
    insertPrompts,
    selectPromptsByIds,
} from '@tests/lib/database/prompts.js';

describe('PUT /prompts/:id', () => {
    let db: TestDatabaseConnection;
    const fixtureCategory = promptCategoryModelFactory.create({
        name: 'Update Prompt Fixture Category',
    });
    const otherFixtureCategory = promptCategoryModelFactory.create({
        name: 'Update Prompt Other Fixture Category',
    });

    beforeAll(async () => {
        db = databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory, otherFixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id, otherFixtureCategory.id]);
        await databaseClient.close();
    });

    it('updates and returns the prompt', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);
        const payload = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            description: 'Updated description',
            category_id: otherFixtureCategory.id,
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: fixturePrompt.id,
            category: { id: otherFixtureCategory.id, name: otherFixtureCategory.name },
            title: payload.title,
            prompt: payload.prompt,
            description: payload.description,
        });
        const body = response.body as { createdAt: string; updatedAt: string };
        expect(body.createdAt).toBe(fixturePrompt.createdAt.toISOString());
        expect(body.updatedAt).not.toBe(body.createdAt);

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('clears the description when its value is supplied as null', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);
        const payload = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            description: null,
            category_id: fixtureCategory.id,
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(payload);

        expect(response.status).toBe(200);
        const body = response.body as { description?: string };
        expect(body.description).toBeUndefined();

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('sets the description to empty text, distinct from clearing it', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);
        const payload = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            description: '',
            category_id: fixtureCategory.id,
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ description: '' });

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('returns a not-found error when the path id matches no prompt', async () => {
        const missingId = faker.string.uuid();

        const response = await request(app).put(`/prompts/${missingId}`).send({
            title: 'title',
            prompt: 'prompt',
            description: 'description',
            category_id: fixtureCategory.id,
        });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: `Prompt not found: ${missingId}` });
    });

    it('returns a category-invalid error when category_id matches no category', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);
        const missingCategoryId = faker.string.uuid();

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send({
            title: 'title',
            prompt: 'prompt',
            description: 'description',
            category_id: missingCategoryId,
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: `Category not found: ${missingCategoryId}` });

        const unchanged = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(unchanged).toMatchObject([
            {
                title: fixturePrompt.title,
                prompt: fixturePrompt.prompt,
                promptCategoryId: fixtureCategory.id,
            },
        ]);

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('returns only the not-found error when both the path id and the category_id are invalid', async () => {
        const missingId = faker.string.uuid();
        const missingCategoryId = faker.string.uuid();

        const response = await request(app).put(`/prompts/${missingId}`).send({
            title: 'title',
            prompt: 'prompt',
            description: 'description',
            category_id: missingCategoryId,
        });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: `Prompt not found: ${missingId}` });
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required fields', async () => {
            const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
            await insertPrompts(db, [fixturePrompt]);

            const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send({});

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.title', error: 'Missing required value' },
                    { field: 'body.prompt', error: 'Missing required value' },
                    { field: 'body.category_id', error: 'Missing required value' },
                    {
                        field: 'body.description',
                        error: 'Invalid input: expected string, received undefined',
                    },
                ]),
            });

            await deletePromptsByIds(db, [fixturePrompt.id]);
        });

        it('returns an invalid value error for a non-uuid category_id', async () => {
            const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
            await insertPrompts(db, [fixturePrompt]);

            const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send({
                title: 'title',
                prompt: 'prompt',
                category_id: '12345',
                description: null,
            });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'body.category_id', error: 'Invalid UUID value' },
                ]),
            });

            await deletePromptsByIds(db, [fixturePrompt.id]);
        });

        it('returns an invalid value error for a non-uuid path id', async () => {
            const response = await request(app).put('/prompts/not-a-uuid').send({
                title: 'title',
                prompt: 'prompt',
                category_id: fixtureCategory.id,
                description: 'description',
            });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'params.id', error: 'Invalid UUID value' },
                ]),
            });
        });
    });
});
