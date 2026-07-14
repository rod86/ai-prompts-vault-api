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
    const otherFixtureCategory = promptCategoryModelFactory.create();

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory, otherFixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id, otherFixtureCategory.id]);
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

    it('clears the description when it is omitted from the request', async () => {
        const fixturePrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            description: 'An existing description',
        });
        await insertPrompts(db, [fixturePrompt]);

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(body);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: fixturePrompt.id,
            title: body.title,
            prompt: body.prompt,
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            created_at: expect.any(String),
            updated_at: expect.any(String),
        });

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted?.description).toBeNull();

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('sets the description to an empty string when submitted as one, instead of clearing it', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
            description: '',
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(body);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: fixturePrompt.id,
            title: body.title,
            prompt: body.prompt,
            description: '',
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            created_at: expect.any(String),
            updated_at: expect.any(String),
        });

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted?.description).toBe('');

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('updates the category and echoes the new category when category_id changes', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: otherFixtureCategory.id,
            description: 'Updated description',
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(body);

        expect(response.status).toBe(200);
        expect(response.body.category).toEqual({
            id: otherFixtureCategory.id,
            name: otherFixtureCategory.name,
        });

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted?.promptCategoryId).toBe(otherFixtureCategory.id);

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });
});