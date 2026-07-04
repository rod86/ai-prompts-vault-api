import { faker } from '@faker-js/faker';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { DrizzlePromptRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptRepository.js';
import { databaseClient } from '@logic/shared/services.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';
import { deletePromptsByIds, insertPrompts, type PromptFixture } from '@tests/lib/seeding/prompts.js';

const FIXTURE_CATEGORY: PromptCategory = { id: faker.string.uuid(), name: 'Coding & Development' };
const OTHER_CATEGORY: PromptCategory = { id: faker.string.uuid(), name: 'Business & Finance' };

const OLDER_PROMPT: PromptFixture = {
    id: faker.string.uuid(),
    categoryId: FIXTURE_CATEGORY.id,
    title: 'Older prompt',
    prompt: faker.lorem.paragraph(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent(),
};

const NEWER_PROMPT: PromptFixture = {
    id: faker.string.uuid(),
    categoryId: FIXTURE_CATEGORY.id,
    title: 'Newer prompt',
    prompt: faker.lorem.paragraph(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
};

const OTHER_CATEGORY_PROMPT: PromptFixture = {
    id: faker.string.uuid(),
    categoryId: OTHER_CATEGORY.id,
    title: 'Other category prompt',
    prompt: faker.lorem.paragraph(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
};

describe('DrizzlePromptRepository', () => {
    let db: NodePgDatabase<Record<string, unknown>>;
    let repository: DrizzlePromptRepository;

    beforeAll(async () => {
        db = databaseClient.connect();
        repository = new DrizzlePromptRepository(db);
        await insertPromptCategories(db, [FIXTURE_CATEGORY, OTHER_CATEGORY]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [FIXTURE_CATEGORY.id, OTHER_CATEGORY.id]);
        await databaseClient.close();
    });

    describe('findAll', () => {
        afterEach(async () => {
            await deletePromptsByIds(db, [
                OLDER_PROMPT.id,
                NEWER_PROMPT.id,
                OTHER_CATEGORY_PROMPT.id,
            ]);
        });

        it('returns every prompt joined with its category, most-recent-first', async () => {
            await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT]);

            const result = await repository.findAll();

            const fixtureIds = new Set([OLDER_PROMPT.id, NEWER_PROMPT.id]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult).toEqual([
                {
                    id: NEWER_PROMPT.id,
                    category: { id: FIXTURE_CATEGORY.id, name: FIXTURE_CATEGORY.name },
                    title: NEWER_PROMPT.title,
                    prompt: NEWER_PROMPT.prompt,
                    description: NEWER_PROMPT.description,
                    createdAt: NEWER_PROMPT.createdAt,
                    updatedAt: NEWER_PROMPT.updatedAt,
                },
                {
                    id: OLDER_PROMPT.id,
                    category: { id: FIXTURE_CATEGORY.id, name: FIXTURE_CATEGORY.name },
                    title: OLDER_PROMPT.title,
                    prompt: OLDER_PROMPT.prompt,
                    description: OLDER_PROMPT.description,
                    createdAt: OLDER_PROMPT.createdAt,
                    updatedAt: OLDER_PROMPT.updatedAt,
                },
            ]);
        });

        it('returns only prompts belonging to a given category', async () => {
            await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT, OTHER_CATEGORY_PROMPT]);

            const result = await repository.findAll({ categoryId: FIXTURE_CATEGORY.id });

            const fixtureIds = new Set([
                OLDER_PROMPT.id,
                NEWER_PROMPT.id,
                OTHER_CATEGORY_PROMPT.id,
            ]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult.map((prompt) => prompt.id)).toEqual([
                NEWER_PROMPT.id,
                OLDER_PROMPT.id,
            ]);
        });

        it('returns an empty array when the category filter matches nothing', async () => {
            await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT]);

            const result = await repository.findAll({ categoryId: faker.string.uuid() });

            expect(result).toEqual([]);
        });

        it('returns an empty array when the category filter is not UUID-shaped', async () => {
            await insertPrompts(db, [OLDER_PROMPT, NEWER_PROMPT]);

            const result = await repository.findAll({ categoryId: 'not-a-uuid' });

            expect(result).toEqual([]);
        });

        it('returns an empty array when there are no prompts at all', async () => {
            const result = await repository.findAll();

            const fixtureIds = new Set([
                OLDER_PROMPT.id,
                NEWER_PROMPT.id,
                OTHER_CATEGORY_PROMPT.id,
            ]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult).toEqual([]);
        });

        it('represents a prompt with no description as an absent value', async () => {
            const promptWithoutDescription: PromptFixture = {
                id: faker.string.uuid(),
                categoryId: FIXTURE_CATEGORY.id,
                title: 'Prompt without description',
                prompt: faker.lorem.paragraph(),
                createdAt: faker.date.recent(),
                updatedAt: faker.date.recent(),
            };

            await insertPrompts(db, [promptWithoutDescription]);

            const result = await repository.findAll();

            const match = result.find((prompt) => prompt.id === promptWithoutDescription.id);
            expect(match?.description).toBeUndefined();

            await deletePromptsByIds(db, [promptWithoutDescription.id]);
        });
    });
});
