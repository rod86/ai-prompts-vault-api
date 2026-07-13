import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient, type DatabaseSchema } from '@src/modules/shared/services.js';
import { promptCategoryModelFactory, promptModelFactory } from '@tests/lib/config.js';
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

    describe('when the prompt and category exist', () => {
        const category = promptCategoryModelFactory.create();
        const existingPrompt = promptModelFactory.create({ categoryId: category.id });

        beforeAll(async () => {
            await insertPromptCategories(db, [category]);
            await insertPrompts(db, [existingPrompt]);
        });

        afterAll(async () => {
            await deletePromptsByIds(db, [existingPrompt.id]);
            await deletePromptCategoriesByIds(db, [category.id]);
        });

        it('updates the prompt and returns 200 with the stored prompt', async () => {
            const body = {
                title: 'Updated title',
                prompt: 'Updated prompt text',
                category_id: category.id,
                description: 'Updated description',
            };

            const response = await request(app).put(`/prompts/${existingPrompt.id}`).send(body);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                id: existingPrompt.id,
                title: body.title,
                prompt: body.prompt,
                description: body.description,
                category: { id: category.id, name: category.name },
                created_at: expect.any(String),
                updated_at: expect.any(String),
            });
            expect(new Date(response.body.created_at)).toEqual(existingPrompt.createdAt);
            expect(new Date(response.body.updated_at)).not.toEqual(existingPrompt.updatedAt);

            const [persisted] = await selectPromptsByIds(db, [existingPrompt.id]);
            expect(persisted).toMatchObject({
                id: existingPrompt.id,
                promptCategoryId: category.id,
                title: body.title,
                prompt: body.prompt,
                description: body.description,
            });
        });

        it('omits the description key and clears it when not submitted', async () => {
            const body = {
                title: 'Title without description',
                prompt: 'Prompt without description',
                category_id: category.id,
            };

            const response = await request(app).put(`/prompts/${existingPrompt.id}`).send(body);

            expect(response.status).toBe(200);
            expect(response.body).not.toHaveProperty('description');

            const [persisted] = await selectPromptsByIds(db, [existingPrompt.id]);
            expect(persisted?.description).toBeNull();
        });
    });

    describe('when the category_id changes to a different existing category', () => {
        const firstCategory = promptCategoryModelFactory.create();
        const secondCategory = promptCategoryModelFactory.create();
        const existingPrompt = promptModelFactory.create({ categoryId: firstCategory.id });

        beforeAll(async () => {
            await insertPromptCategories(db, [firstCategory, secondCategory]);
            await insertPrompts(db, [existingPrompt]);
        });

        afterAll(async () => {
            await deletePromptsByIds(db, [existingPrompt.id]);
            await deletePromptCategoriesByIds(db, [firstCategory.id, secondCategory.id]);
        });

        it('updates and echoes the new category', async () => {
            const body = {
                title: 'Moved title',
                prompt: 'Moved prompt text',
                category_id: secondCategory.id,
            };

            const response = await request(app).put(`/prompts/${existingPrompt.id}`).send(body);

            expect(response.status).toBe(200);
            expect(response.body.category).toEqual({
                id: secondCategory.id,
                name: secondCategory.name,
            });

            const [persisted] = await selectPromptsByIds(db, [existingPrompt.id]);
            expect(persisted?.promptCategoryId).toBe(secondCategory.id);
        });
    });

    describe('Request Validation', () => {
        it('rejects a malformed path id as a validation failure before any lookup', async () => {
            const body = {
                title: 'Some title',
                prompt: 'Some prompt text',
                category_id: '00000000-0000-0000-0000-000000000000',
            };

            const response = await request(app).put('/prompts/not-a-uuid').send(body);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'RequestValidationError',
                message: 'Request Validation data failed',
                details: { params: { id: expect.any(String) } },
            });
        });

        it('rejects a missing required body field as a validation failure', async () => {
            const promptId = '00000000-0000-0000-0000-000000000000';
            const body = {
                prompt: 'Some prompt text',
                category_id: '00000000-0000-0000-0000-000000000000',
            };

            const response = await request(app).put(`/prompts/${promptId}`).send(body);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'RequestValidationError',
                message: 'Request Validation data failed',
                details: { body: { title: expect.any(String) } },
            });
        });

        it('rejects a malformed category_id as a validation failure before any lookup', async () => {
            const promptId = '00000000-0000-0000-0000-000000000000';
            const body = {
                title: 'Some title',
                prompt: 'Some prompt text',
                category_id: 'not-a-uuid',
            };

            const response = await request(app).put(`/prompts/${promptId}`).send(body);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'RequestValidationError',
                message: 'Request Validation data failed',
                details: { body: { category_id: expect.any(String) } },
            });
        });
    });

    describe('when the prompt does not exist', () => {
        const category = promptCategoryModelFactory.create();

        beforeAll(async () => {
            await insertPromptCategories(db, [category]);
        });

        afterAll(async () => {
            await deletePromptCategoriesByIds(db, [category.id]);
        });

        it('returns 404 prompt-not-found', async () => {
            const unknownPromptId = '00000000-0000-0000-0000-000000000000';
            const body = {
                title: 'Some title',
                prompt: 'Some prompt text',
                category_id: category.id,
            };

            const response = await request(app).put(`/prompts/${unknownPromptId}`).send(body);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                error: 'PromptNotFoundError',
                message: `Prompt not found: ${unknownPromptId}`,
            });

            const persisted = await selectPromptsByIds(db, [unknownPromptId]);
            expect(persisted).toEqual([]);
        });
    });

    describe('when the prompt exists but the category_id matches no category', () => {
        const category = promptCategoryModelFactory.create();
        const existingPrompt = promptModelFactory.create({ categoryId: category.id });

        beforeAll(async () => {
            await insertPromptCategories(db, [category]);
            await insertPrompts(db, [existingPrompt]);
        });

        afterAll(async () => {
            await deletePromptsByIds(db, [existingPrompt.id]);
            await deletePromptCategoriesByIds(db, [category.id]);
        });

        it('returns 422 category-not-found and leaves the prompt unchanged', async () => {
            const unknownCategoryId = '00000000-0000-0000-0000-000000000000';
            const body = {
                title: 'Some title',
                prompt: 'Some prompt text',
                category_id: unknownCategoryId,
            };

            const response = await request(app).put(`/prompts/${existingPrompt.id}`).send(body);

            expect(response.status).toBe(422);
            expect(response.body).toEqual({
                error: 'CategoryNotFoundError',
                message: `Category not found: ${unknownCategoryId}`,
            });

            const [persisted] = await selectPromptsByIds(db, [existingPrompt.id]);
            expect(persisted).toMatchObject({
                id: existingPrompt.id,
                promptCategoryId: category.id,
                title: existingPrompt.title,
                prompt: existingPrompt.prompt,
            });
        });
    });
});
