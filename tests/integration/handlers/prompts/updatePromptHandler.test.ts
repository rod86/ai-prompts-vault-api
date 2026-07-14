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
import { deletePromptsByIds, insertPrompts, selectPromptsByIds } from '@tests/lib/database/prompts.js';

describe('PUT /prompts/:id', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    const fixtureCategory = promptCategoryModelFactory.create();

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id]);
        await client.close();
    });

    it('updates a prompt and returns 200 with the stored prompt', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
            description: 'Updated description',
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(body);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: fixturePrompt.id,
            title: body.title,
            prompt: body.prompt,
            description: body.description,
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            created_at: expect.any(String),
            updated_at: expect.any(String),
        });
        expect(response.body.created_at).toBe(fixturePrompt.createdAt.toISOString());
        expect(response.body.updated_at).not.toBe(fixturePrompt.updatedAt.toISOString());

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toMatchObject({
            id: fixturePrompt.id,
            promptCategoryId: fixtureCategory.id,
            title: body.title,
            prompt: body.prompt,
            description: body.description,
        });

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });
});