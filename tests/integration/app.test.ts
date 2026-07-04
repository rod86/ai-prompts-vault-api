import { faker } from '@faker-js/faker';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { databaseClient } from '@logic/shared/services.js';
import app from '@src/app.js';
import {
    deletePromptCategoriesByIds,
    getAllPromptCategories,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';
import { deletePromptsByIds, insertPrompts, type PromptFixture } from '@tests/lib/seeding/prompts.js';

const FIXTURE_CATEGORIES: PromptCategory[] = [
    { id: faker.string.uuid(), name: 'Zzz Topic' },
    { id: faker.string.uuid(), name: 'Aaa Topic' },
];

const PROMPTS_FIXTURE_CATEGORY: PromptCategory = {
    id: faker.string.uuid(),
    name: 'Prompts Fixture Category',
};

const OLDER_PROMPT: PromptFixture = {
    id: faker.string.uuid(),
    categoryId: PROMPTS_FIXTURE_CATEGORY.id,
    title: 'Older prompt',
    prompt: faker.lorem.paragraph(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent(),
};

const NEWER_PROMPT: PromptFixture = {
    id: faker.string.uuid(),
    categoryId: PROMPTS_FIXTURE_CATEGORY.id,
    title: 'Newer prompt',
    prompt: faker.lorem.paragraph(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
};

const OTHER_PROMPTS_CATEGORY: PromptCategory = {
    id: faker.string.uuid(),
    name: 'Other Prompts Fixture Category',
};

const OTHER_CATEGORY_PROMPT: PromptFixture = {
    id: faker.string.uuid(),
    categoryId: OTHER_PROMPTS_CATEGORY.id,
    title: 'Other category prompt',
    prompt: faker.lorem.paragraph(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
};

let db: NodePgDatabase<Record<string, unknown>>;

beforeAll(async () => {
    db = databaseClient.connect();
    await insertPromptCategories(db, [PROMPTS_FIXTURE_CATEGORY, OTHER_PROMPTS_CATEGORY]);
});

afterAll(async () => {
    await deletePromptCategoriesByIds(db, [PROMPTS_FIXTURE_CATEGORY.id, OTHER_PROMPTS_CATEGORY.id]);
    await databaseClient.close();
});

describe('GET /categories', () => {
    afterEach(async () => {
        await deletePromptCategoriesByIds(
            db,
            FIXTURE_CATEGORIES.map((category) => category.id),
        );
    });

    it('returns all categories ordered alphabetically by name', async () => {
        await insertPromptCategories(db, FIXTURE_CATEGORIES);
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
    afterEach(async () => {
        await deletePromptsByIds(db, [OLDER_PROMPT.id, NEWER_PROMPT.id, OTHER_CATEGORY_PROMPT.id]);
    });

    it('returns all prompts ordered most-recently-created-first', async () => {
        await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT]);

        const response = await request(app).get('/prompts');

        const fixtureIds = new Set([OLDER_PROMPT.id, NEWER_PROMPT.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([
            {
                id: NEWER_PROMPT.id,
                category: { id: PROMPTS_FIXTURE_CATEGORY.id, name: PROMPTS_FIXTURE_CATEGORY.name },
                title: NEWER_PROMPT.title,
                prompt: NEWER_PROMPT.prompt,
                description: NEWER_PROMPT.description,
                createdAt: NEWER_PROMPT.createdAt.toISOString(),
                updatedAt: NEWER_PROMPT.updatedAt.toISOString(),
            },
            {
                id: OLDER_PROMPT.id,
                category: { id: PROMPTS_FIXTURE_CATEGORY.id, name: PROMPTS_FIXTURE_CATEGORY.name },
                title: OLDER_PROMPT.title,
                prompt: OLDER_PROMPT.prompt,
                description: OLDER_PROMPT.description,
                createdAt: OLDER_PROMPT.createdAt.toISOString(),
                updatedAt: OLDER_PROMPT.updatedAt.toISOString(),
            },
        ]);
    });

    it('returns an empty list when there are no prompts', async () => {
        const response = await request(app).get('/prompts');

        const fixtureIds = new Set([OLDER_PROMPT.id, NEWER_PROMPT.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([]);
    });

    it('returns only prompts in the requested category when filtered', async () => {
        await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT, OTHER_CATEGORY_PROMPT]);

        const response = await request(app).get(
            `/prompts?category=${PROMPTS_FIXTURE_CATEGORY.id}`,
        );

        const fixtureIds = new Set([OLDER_PROMPT.id, NEWER_PROMPT.id, OTHER_CATEGORY_PROMPT.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse.map((prompt) => prompt.id)).toEqual([
            NEWER_PROMPT.id,
            OLDER_PROMPT.id,
        ]);
    });

    it('returns an empty list when the category filter matches nothing', async () => {
        await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT]);

        const response = await request(app).get(`/prompts?category=${faker.string.uuid()}`);

        const fixtureIds = new Set([OLDER_PROMPT.id, NEWER_PROMPT.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([]);
    });

    it('returns an empty list when the category filter is not UUID-shaped', async () => {
        await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT]);

        const response = await request(app).get('/prompts?category=not-a-uuid');

        const fixtureIds = new Set([OLDER_PROMPT.id, NEWER_PROMPT.id]);
        const fixturesInResponse = (response.body as Array<{ id: string }>).filter((prompt) =>
            fixtureIds.has(prompt.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual([]);
    });

    it('includes a prompt with no description, with no description value', async () => {
        const promptWithoutDescription: PromptFixture = {
            id: faker.string.uuid(),
            categoryId: PROMPTS_FIXTURE_CATEGORY.id,
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
