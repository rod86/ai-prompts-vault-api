import { faker } from '@faker-js/faker';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DrizzlePromptRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptRepository.js';
import { databaseClient } from '@logic/shared/services.js';
import { promptCategoryModelFactory, promptModelFactory } from '@tests/lib/config.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';
import { deletePromptsByIds, insertPrompts } from '@tests/lib/seeding/prompts.js';

describe('DrizzlePromptRepository', () => {
    describe('findAll', () => {
        let db: NodePgDatabase<Record<string, unknown>>;
        let repository: DrizzlePromptRepository;
        const fixtureCategory = promptCategoryModelFactory.create({ name: 'Coding & Development' });
        const otherCategory = promptCategoryModelFactory.create({ name: 'Business & Finance' });
        const olderPrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            title: 'Older prompt',
            createdAt: faker.date.past({ years: 2 }),
        });
        const newerPrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            title: 'Newer prompt',
            createdAt: faker.date.recent(),
        });
        const otherCategoryPrompt = promptModelFactory.create({
            categoryId: otherCategory.id,
            title: 'Other category prompt',
            createdAt: faker.date.recent(),
        });

        beforeAll(async () => {
            db = databaseClient.connect();
            repository = new DrizzlePromptRepository(db);
            await insertPromptCategories(db, [fixtureCategory, otherCategory]);
        });

        afterAll(async () => {
            await deletePromptCategoriesByIds(db, [fixtureCategory.id, otherCategory.id]);
            await databaseClient.close();
        });

        afterEach(async () => {
            await deletePromptsByIds(db, [olderPrompt.id, newerPrompt.id, otherCategoryPrompt.id]);
        });

        it('returns every prompt joined with its category, most-recent-first', async () => {
            await insertPrompts(db, [olderPrompt, newerPrompt]);

            const result = await repository.findAll();

            const fixtureIds = new Set([olderPrompt.id, newerPrompt.id]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult).toEqual([
                {
                    id: newerPrompt.id,
                    category: { id: fixtureCategory.id, name: fixtureCategory.name },
                    title: newerPrompt.title,
                    prompt: newerPrompt.prompt,
                    description: newerPrompt.description,
                    createdAt: newerPrompt.createdAt,
                    updatedAt: newerPrompt.updatedAt,
                },
                {
                    id: olderPrompt.id,
                    category: { id: fixtureCategory.id, name: fixtureCategory.name },
                    title: olderPrompt.title,
                    prompt: olderPrompt.prompt,
                    description: olderPrompt.description,
                    createdAt: olderPrompt.createdAt,
                    updatedAt: olderPrompt.updatedAt,
                },
            ]);
        });

        it('returns only prompts belonging to a given category', async () => {
            await insertPrompts(db, [olderPrompt, newerPrompt, otherCategoryPrompt]);

            const result = await repository.findAll({ categoryId: fixtureCategory.id });

            const fixtureIds = new Set([olderPrompt.id, newerPrompt.id, otherCategoryPrompt.id]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult.map((prompt) => prompt.id)).toEqual([
                newerPrompt.id,
                olderPrompt.id,
            ]);
        });

        it('returns an empty array when the category filter matches nothing', async () => {
            await insertPrompts(db, [olderPrompt, newerPrompt]);

            const result = await repository.findAll({ categoryId: faker.string.uuid() });

            expect(result).toEqual([]);
        });

        it('returns an empty array when the category filter is not UUID-shaped', async () => {
            await insertPrompts(db, [olderPrompt, newerPrompt]);

            const result = await repository.findAll({ categoryId: 'not-a-uuid' });

            expect(result).toEqual([]);
        });

        it('returns an empty array when there are no prompts at all', async () => {
            const result = await repository.findAll();

            const fixtureIds = new Set([olderPrompt.id, newerPrompt.id, otherCategoryPrompt.id]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult).toEqual([]);
        });

        it('represents a prompt with no description as an absent value', async () => {
            // Built by hand, not via promptModelFactory: the factory always fills in a
            // fake description, but this test needs one explicitly absent.
            const promptWithoutDescription: PromptModel = {
                id: faker.string.uuid(),
                categoryId: fixtureCategory.id,
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

    describe('findById', () => {
        let db: NodePgDatabase<Record<string, unknown>>;
        let repository: DrizzlePromptRepository;
        const fixtureCategory = promptCategoryModelFactory.create({ name: 'Get Prompt Category' });
        const fixturePrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            title: 'Fixture prompt',
        });

        beforeAll(async () => {
            db = databaseClient.connect();
            repository = new DrizzlePromptRepository(db);
            await insertPromptCategories(db, [fixtureCategory]);
        });

        afterAll(async () => {
            await deletePromptCategoriesByIds(db, [fixtureCategory.id]);
            await databaseClient.close();
        });

        afterEach(async () => {
            await deletePromptsByIds(db, [fixturePrompt.id]);
        });

        it('returns a prompt joined with its category by id', async () => {
            await insertPrompts(db, [fixturePrompt]);

            const result = await repository.findById(fixturePrompt.id);

            expect(result).toEqual({
                id: fixturePrompt.id,
                category: { id: fixtureCategory.id, name: fixtureCategory.name },
                title: fixturePrompt.title,
                prompt: fixturePrompt.prompt,
                description: fixturePrompt.description,
                createdAt: fixturePrompt.createdAt,
                updatedAt: fixturePrompt.updatedAt,
            });
        });

        it('returns undefined when no prompt matches the id', async () => {
            await insertPrompts(db, [fixturePrompt]);

            const result = await repository.findById(faker.string.uuid());

            expect(result).toBeUndefined();
        });

        it('returns undefined when the id is not UUID-shaped', async () => {
            await insertPrompts(db, [fixturePrompt]);

            const result = await repository.findById('not-a-uuid');

            expect(result).toBeUndefined();
        });

        it('represents a prompt with no description as an absent value', async () => {
            // Built by hand, not via promptModelFactory: the factory always fills in a
            // fake description, but this test needs one explicitly absent.
            const promptWithoutDescription: PromptModel = {
                id: faker.string.uuid(),
                categoryId: fixtureCategory.id,
                title: 'Prompt without description',
                prompt: faker.lorem.paragraph(),
                createdAt: faker.date.recent(),
                updatedAt: faker.date.recent(),
            };

            await insertPrompts(db, [promptWithoutDescription]);

            const result = await repository.findById(promptWithoutDescription.id);

            expect(result?.description).toBeUndefined();

            await deletePromptsByIds(db, [promptWithoutDescription.id]);
        });
    });
});
