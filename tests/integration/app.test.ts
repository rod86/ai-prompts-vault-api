import { faker } from '@faker-js/faker';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { databaseClient } from '@logic/shared/services.js';
import app from '@src/app.js';
import { promptCategoryModelFactory, promptModelFactory } from '@tests/lib/config.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';
import {
    deletePromptCategoriesByIds,
    getAllPromptCategories,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';
import { deletePromptsByIds, insertPrompts } from '@tests/lib/seeding/prompts.js';

let db: NodePgDatabase<Record<string, unknown>>;

beforeAll(async () => {
    db = databaseClient.connect();
});

afterAll(async () => {
    await databaseClient.close();
});

describe('GET /categories', () => {
    const fixtureCategories = [
        promptCategoryModelFactory.create({ name: 'Zzz Topic' }),
        promptCategoryModelFactory.create({ name: 'Aaa Topic' }),
    ];

    afterEach(async () => {
        await deletePromptCategoriesByIds(
            db,
            fixtureCategories.map((category) => category.id),
        );
    });

    it('returns all categories ordered alphabetically by name', async () => {
        await insertPromptCategories(db, fixtureCategories);
        const existingCategories = await getAllPromptCategories(db);
        const expected = [...existingCategories].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );

        const response = await request(app).get('/categories');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expected.map((category) => ({ id: category.id, name: category.name })),
        );
    });
});

describe('GET /prompts', () => {
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
});

describe('GET /prompts/:id', () => {
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
