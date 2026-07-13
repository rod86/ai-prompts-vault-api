import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
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
            expect(response.body).not.toHaveProperty('categoryId');
            expect(response.body).not.toHaveProperty('createdAt');
            expect(response.body).not.toHaveProperty('updatedAt');

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
            expect(response.body).not.toHaveProperty('description');

            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted?.description).toBeNull();

            await deletePromptsByIds(db, [response.body.id]);
        });
    });
});
