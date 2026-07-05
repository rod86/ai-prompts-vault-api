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

describe('GET /prompts', () => {
    let db: TestDatabaseConnection;

    beforeAll(async () => {
        db = databaseClient.connect();
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    const promptsFixtureCategory = promptCategoryModelFactory.create({
        name: 'Prompts Fixture Category',
    });
    const otherPromptsCategory = promptCategoryModelFactory.create({
        name: 'Other Prompts Fixture Category',
    });
    const olderPrompt = promptModelFactory.create({
        categoryId: promptsFixtureCategory.id,
        title: 'Older prompt',
        createdAt: faker.date.past({ years: 2 }),
    });
    const newerPrompt = promptModelFactory.create({
        categoryId: promptsFixtureCategory.id,
        title: 'Newer prompt',
        createdAt: faker.date.recent(),
    });
    const otherCategoryPrompt = promptModelFactory.create({
        categoryId: otherPromptsCategory.id,
        title: 'Other category prompt',
        createdAt: faker.date.recent(),
    });

    beforeAll(async () => {
        await insertPromptCategories(db, [promptsFixtureCategory, otherPromptsCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [promptsFixtureCategory.id, otherPromptsCategory.id]);
    });

    afterEach(async () => {
        await deletePromptsByIds(db, [olderPrompt.id, newerPrompt.id, otherCategoryPrompt.id]);
    });

    it('returns all prompts ordered most-recently-created-first', async () => {
        await insertPrompts(db, [olderPrompt, newerPrompt]);

        const response = await request(app).get('/prompts');

        const fixtureIds = new Set([olderPrompt.id, newerPrompt.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([
            {
                id: newerPrompt.id,
                category: { id: promptsFixtureCategory.id, name: promptsFixtureCategory.name },
                title: newerPrompt.title,
                prompt: newerPrompt.prompt,
                description: newerPrompt.description,
                createdAt: newerPrompt.createdAt.toISOString(),
                updatedAt: newerPrompt.updatedAt.toISOString(),
            },
            {
                id: olderPrompt.id,
                category: { id: promptsFixtureCategory.id, name: promptsFixtureCategory.name },
                title: olderPrompt.title,
                prompt: olderPrompt.prompt,
                description: olderPrompt.description,
                createdAt: olderPrompt.createdAt.toISOString(),
                updatedAt: olderPrompt.updatedAt.toISOString(),
            },
        ]);
    });

    it('returns an empty list when there are no prompts', async () => {
        const response = await request(app).get('/prompts');

        const fixtureIds = new Set([olderPrompt.id, newerPrompt.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([]);
    });

    it('returns only prompts in the requested category when filtered', async () => {
        await insertPrompts(db, [olderPrompt, newerPrompt, otherCategoryPrompt]);

        const response = await request(app).get(`/prompts?category=${promptsFixtureCategory.id}`);

        const fixtureIds = new Set([olderPrompt.id, newerPrompt.id, otherCategoryPrompt.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse.map((prompt) => prompt.id)).toEqual([
            newerPrompt.id,
            olderPrompt.id,
        ]);
    });

    it('returns an empty list when the category filter matches nothing', async () => {
        await insertPrompts(db, [olderPrompt, newerPrompt]);

        const response = await request(app).get(`/prompts?category=${faker.string.uuid()}`);

        const fixtureIds = new Set([olderPrompt.id, newerPrompt.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([]);
    });

    it('returns an empty list when the category filter is not UUID-shaped', async () => {
        await insertPrompts(db, [olderPrompt, newerPrompt]);

        const response = await request(app).get('/prompts?category=not-a-uuid');

        const fixtureIds = new Set([olderPrompt.id, newerPrompt.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([]);
    });

    it('includes a prompt with no description, with no description value', async () => {
        // Built by hand, not via promptModelFactory: the factory always fills in a
        // fake description, but this test needs one explicitly absent.
        const promptWithoutDescription: PromptModel = {
            id: faker.string.uuid(),
            categoryId: promptsFixtureCategory.id,
            title: 'Prompt without description',
            prompt: faker.lorem.paragraph(),
            createdAt: faker.date.recent(),
            updatedAt: faker.date.recent(),
        };
        await insertPrompts(db, [promptWithoutDescription]);

        const response = await request(app).get('/prompts');

        const match = (response.body as Array<{ id: string; description?: string }>).find(
            (prompt) => prompt.id === promptWithoutDescription.id,
        );

        expect(response.status).toBe(200);
        expect(match?.description).toBeUndefined();

        await deletePromptsByIds(db, [promptWithoutDescription.id]);
    });

    describe('Request Validation', () => {
        it('returns a malformed-request response when the category query is repeated', async () => {
            const response = await request(app).get('/prompts?category=a&category=b');

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'query.category', error: 'Expected string, received array' },
                ]),
            });
        });
    });
});
