import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import {
    databaseClient,
    promptCategoryModelFactory,
    promptModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';
import { deletePromptsByIds, insertPrompts } from '@tests/lib/seeding/prompts.js';

describe('GET /prompts/:id', () => {
    let db: TestDatabaseConnection;

    beforeAll(async () => {
        db = databaseClient.connect();
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    const getPromptFixtureCategory = promptCategoryModelFactory.create({
        name: 'Get Prompt Fixture Category',
    });
    const fixturePrompt = promptModelFactory.create({
        categoryId: getPromptFixtureCategory.id,
        title: 'Fixture prompt for get by id',
    });

    beforeAll(async () => {
        await insertPromptCategories(db, [getPromptFixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [getPromptFixtureCategory.id]);
    });

    afterEach(async () => {
        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('returns the full prompt when it exists', async () => {
        await insertPrompts(db, [fixturePrompt]);

        const response = await request(app).get(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: fixturePrompt.id,
            category: { id: getPromptFixtureCategory.id, name: getPromptFixtureCategory.name },
            title: fixturePrompt.title,
            prompt: fixturePrompt.prompt,
            description: fixturePrompt.description,
            createdAt: fixturePrompt.createdAt.toISOString(),
            updatedAt: fixturePrompt.updatedAt.toISOString(),
        });
    });

    it('returns 404 when the id matches no prompt', async () => {
        const missingId = faker.string.uuid();

        const response = await request(app).get(`/prompts/${missingId}`);

        expect(response.status).toBe(404);
        expect((response.body as { error: string }).error).toBeDefined();
    });

    it('returns 404 when the id is not UUID-shaped', async () => {
        const response = await request(app).get('/prompts/not-a-uuid');

        expect(response.status).toBe(404);
    });

    it('includes a prompt with no description, with no description value', async () => {
        // Built by hand, not via promptModelFactory: the factory always fills in a
        // fake description, but this test needs one explicitly absent.
        const promptWithoutDescription: PromptModel = {
            id: faker.string.uuid(),
            categoryId: getPromptFixtureCategory.id,
            title: 'Prompt without description',
            prompt: faker.lorem.paragraph(),
            createdAt: faker.date.recent(),
            updatedAt: faker.date.recent(),
        };
        await insertPrompts(db, [promptWithoutDescription]);

        const response = await request(app).get(`/prompts/${promptWithoutDescription.id}`);

        expect(response.status).toBe(200);
        expect((response.body as { description?: string }).description).toBeUndefined();

        await deletePromptsByIds(db, [promptWithoutDescription.id]);
    });
});
