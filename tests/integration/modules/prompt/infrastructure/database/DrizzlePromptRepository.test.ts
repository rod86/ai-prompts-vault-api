import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import { DrizzlePromptRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptRepository.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { type DatabaseSchema } from '@src/modules/shared/services.js';
import {
    promptCategoryModelFactory,
    promptModelFactory,
    userModelFactory,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import {
    deletePromptsByIds,
    insertPrompts,
    selectPromptsByIds,
} from '@tests/lib/database/prompts.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';

describe('DrizzlePromptRepository', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    let repository: DrizzlePromptRepository;
    const recipeCategory = promptCategoryModelFactory.create({ name: 'Recipes & Cooking' });
    const travelCategory = promptCategoryModelFactory.create({ name: 'Travel & Adventure' });
    const fitnessCategory = promptCategoryModelFactory.create({ name: 'Fitness & Wellness' });
    const creatorUser = userModelFactory.create();

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        repository = new DrizzlePromptRepository(client, schema);
        await insertPromptCategories(db, [recipeCategory, travelCategory, fitnessCategory]);
        await insertUsers(db, [creatorUser]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [
            recipeCategory.id,
            travelCategory.id,
            fitnessCategory.id,
        ]);
        await deleteUsersByIds(db, [creatorUser.id]);
        await client.close();
    });

    describe('findAll', () => {
        const olderPrompt = promptModelFactory.create({
            categoryId: recipeCategory.id,
            userId: creatorUser.id,
            title: 'Older prompt',
            createdAt: faker.date.past({ years: 2 }),
        });
        const newerPrompt = promptModelFactory.create({
            categoryId: recipeCategory.id,
            userId: creatorUser.id,
            title: 'Newer prompt',
            createdAt: faker.date.recent(),
        });
        const otherCategoryPrompt = promptModelFactory.create({
            categoryId: travelCategory.id,
            userId: creatorUser.id,
            title: 'Other category prompt',
            createdAt: faker.date.recent(),
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
                    category: { id: recipeCategory.id, name: recipeCategory.name },
                    user: { id: creatorUser.id, name: creatorUser.name },
                    title: newerPrompt.title,
                    prompt: newerPrompt.prompt,
                    description: newerPrompt.description,
                    createdAt: newerPrompt.createdAt,
                    updatedAt: newerPrompt.updatedAt,
                },
                {
                    id: olderPrompt.id,
                    category: { id: recipeCategory.id, name: recipeCategory.name },
                    user: { id: creatorUser.id, name: creatorUser.name },
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

            const result = await repository.findAll({ categoryId: recipeCategory.id });

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
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
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
        const fixturePrompt = promptModelFactory.create({
            categoryId: fitnessCategory.id,
            userId: creatorUser.id,
            title: 'Fixture prompt',
        });

        afterEach(async () => {
            await deletePromptsByIds(db, [fixturePrompt.id]);
        });

        it('returns a prompt joined with its category by id', async () => {
            await insertPrompts(db, [fixturePrompt]);

            const result = await repository.findById(fixturePrompt.id);

            expect(result).toEqual({
                id: fixturePrompt.id,
                category: { id: fitnessCategory.id, name: fitnessCategory.name },
                user: { id: creatorUser.id, name: creatorUser.name },
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
                categoryId: fitnessCategory.id,
                userId: creatorUser.id,
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

    describe('create', () => {
        it('persists a new prompt row', async () => {
            const fixture = promptModelFactory.create({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
            });
            const fixturePrompt = {
                id: fixture.id,
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: fixture.title,
                prompt: fixture.prompt,
                description: fixture.description,
                createdAt: fixture.createdAt,
                updatedAt: fixture.updatedAt,
            };

            await repository.create(fixturePrompt);
            const [result] = await selectPromptsByIds(db, [fixture.id]);

            expect(result).toEqual({
                id: fixture.id,
                promptCategoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: fixture.title,
                prompt: fixture.prompt,
                description: fixture.description,
                createdAt: fixture.createdAt,
                updatedAt: fixture.updatedAt,
            });

            await deletePromptsByIds(db, [fixture.id]);
        });

        it('persists a prompt with no description as an absent value', async () => {
            const fixture: PromptModel = {
                id: faker.string.uuid(),
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: 'Prompt without description',
                prompt: faker.lorem.paragraph(),
                createdAt: faker.date.recent(),
                updatedAt: faker.date.recent(),
            };
            const fixturePrompt = {
                id: fixture.id,
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: fixture.title,
                prompt: fixture.prompt,
                description: undefined,
                createdAt: fixture.createdAt,
                updatedAt: fixture.updatedAt,
            };

            await repository.create(fixturePrompt);
            const [result] = await selectPromptsByIds(db, [fixture.id]);

            expect(result?.description).toBeNull();

            await deletePromptsByIds(db, [fixture.id]);
        });

        it('persists the creator and resolves it via findById and findAll', async () => {
            const fixture = promptModelFactory.create({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
            });
            const fixturePrompt = {
                id: fixture.id,
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: fixture.title,
                prompt: fixture.prompt,
                description: fixture.description,
                createdAt: fixture.createdAt,
                updatedAt: fixture.updatedAt,
            };

            await repository.create(fixturePrompt);

            const [persisted] = await selectPromptsByIds(db, [fixture.id]);
            expect(persisted).toMatchObject({ userId: creatorUser.id });

            const foundById = await repository.findById(fixture.id);
            expect(foundById?.user).toEqual({ id: creatorUser.id, name: creatorUser.name });

            const foundInAll = await repository.findAll();
            const match = foundInAll.find((prompt) => prompt.id === fixture.id);
            expect(match?.user).toEqual({ id: creatorUser.id, name: creatorUser.name });

            await deletePromptsByIds(db, [fixture.id]);
        });
    });

    describe('update', () => {
        it('persists updated fields for an existing prompt row', async () => {
            const existingPrompt = promptModelFactory.create({
                categoryId: travelCategory.id,
                userId: creatorUser.id,
            });
            await insertPrompts(db, [existingPrompt]);

            const updatePrompt = {
                categoryId: fitnessCategory.id,
                title: 'Updated title',
                prompt: 'Updated prompt text',
                description: 'Updated description',
                updatedAt: faker.date.recent(),
            };

            await repository.update(existingPrompt.id, updatePrompt);
            const [result] = await selectPromptsByIds(db, [existingPrompt.id]);

            expect(result).toEqual({
                id: existingPrompt.id,
                promptCategoryId: fitnessCategory.id,
                userId: creatorUser.id,
                title: updatePrompt.title,
                prompt: updatePrompt.prompt,
                description: updatePrompt.description,
                createdAt: existingPrompt.createdAt,
                updatedAt: updatePrompt.updatedAt,
            });

            await deletePromptsByIds(db, [existingPrompt.id]);
        });

        it('persists an updated prompt with no description as an absent value', async () => {
            const existingPrompt = promptModelFactory.create({
                categoryId: travelCategory.id,
                userId: creatorUser.id,
            });
            await insertPrompts(db, [existingPrompt]);

            const updatePrompt = {
                categoryId: travelCategory.id,
                title: existingPrompt.title,
                prompt: existingPrompt.prompt,
                description: null,
                updatedAt: faker.date.recent(),
            };

            await repository.update(existingPrompt.id, updatePrompt);
            const [result] = await selectPromptsByIds(db, [existingPrompt.id]);

            expect(result?.description).toBeNull();

            await deletePromptsByIds(db, [existingPrompt.id]);
        });
    });

    describe('delete', () => {
        it('removes an existing prompt row', async () => {
            const existingPrompt = promptModelFactory.create({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
            });
            await insertPrompts(db, [existingPrompt]);

            await repository.delete(existingPrompt.id);
            const rows = await selectPromptsByIds(db, [existingPrompt.id]);

            expect(rows).toEqual([]);
        });
    });
});
