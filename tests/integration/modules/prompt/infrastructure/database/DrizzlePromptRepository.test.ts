import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@src/config/drizzle/index.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import { DrizzlePromptRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptRepository.js';
import { type User } from '@src/modules/user/domain/User.js';
import {
    createPromptCategoryFixture,
    createPromptFixture,
    createUserFixture,
    databaseClient,
    promptModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import { selectPromptsByIds } from '@tests/lib/database/prompts.js';
import { type PromptModel } from '@tests/lib/modelFactories/PromptModelFactory.js';

describe('DrizzlePromptRepository', () => {
    const categoryFixture = createPromptCategoryFixture();
    const userFixture = createUserFixture();
    const promptFixture = createPromptFixture();
    let db: TestDatabaseConnection;
    let repository: DrizzlePromptRepository;
    let recipeCategory: PromptCategory;
    let travelCategory: PromptCategory;
    let fitnessCategory: PromptCategory;
    let creatorUser: User;

    beforeAll(async () => {
        db = databaseClient.getConnection();
        repository = new DrizzlePromptRepository(databaseClient, schema);
        recipeCategory = await categoryFixture.insert({ name: 'Recipes & Cooking' });
        travelCategory = await categoryFixture.insert({ name: 'Travel & Adventure' });
        fitnessCategory = await categoryFixture.insert({ name: 'Fitness & Wellness' });
        creatorUser = await userFixture.insert();
    });

    afterEach(async () => {
        await promptFixture.cleanup();
    });

    afterAll(async () => {
        await categoryFixture.cleanup();
        await userFixture.cleanup();
    });

    describe('findAll', () => {
        it('returns every prompt joined with its category, most-recent-first', async () => {
            const olderPrompt = await promptFixture.insert({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: 'Older prompt',
                createdAt: faker.date.past({ years: 2 }),
            });
            const newerPrompt = await promptFixture.insert({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: 'Newer prompt',
                createdAt: faker.date.recent(),
            });

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
            const olderPrompt = await promptFixture.insert({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: 'Older prompt',
                createdAt: faker.date.past({ years: 2 }),
            });
            const newerPrompt = await promptFixture.insert({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: 'Newer prompt',
                createdAt: faker.date.recent(),
            });
            const otherCategoryPrompt = await promptFixture.insert({
                categoryId: travelCategory.id,
                userId: creatorUser.id,
                title: 'Other category prompt',
                createdAt: faker.date.recent(),
            });

            const result = await repository.findAll({ categoryId: recipeCategory.id });

            const fixtureIds = new Set([olderPrompt.id, newerPrompt.id, otherCategoryPrompt.id]);
            const fixturesInResult = result.filter((prompt) => fixtureIds.has(prompt.id));

            expect(fixturesInResult.map((prompt) => prompt.id)).toEqual([
                newerPrompt.id,
                olderPrompt.id,
            ]);
        });

        it('returns an empty array when the category filter matches nothing', async () => {
            await promptFixture.insert({ categoryId: recipeCategory.id, userId: creatorUser.id });

            const result = await repository.findAll({ categoryId: faker.string.uuid() });

            expect(result).toEqual([]);
        });

        it('returns an empty array when the category filter is not UUID-shaped', async () => {
            await promptFixture.insert({ categoryId: recipeCategory.id, userId: creatorUser.id });

            const result = await repository.findAll({ categoryId: 'not-a-uuid' });

            expect(result).toEqual([]);
        });

        it('returns none of this suite’s prompts once they have been cleaned up', async () => {
            // Built but never inserted: confirms afterEach cleanup leaves nothing of ours
            // behind (the shared DB may still hold other suites' rows in parallel).
            const ourIds = new Set([faker.string.uuid(), faker.string.uuid(), faker.string.uuid()]);

            const result = await repository.findAll();

            expect(result.filter((prompt) => ourIds.has(prompt.id))).toEqual([]);
        });

        it('represents a prompt with no description as an absent value', async () => {
            const promptWithoutDescription = await insertPromptWithoutDescription(
                recipeCategory.id,
            );

            const result = await repository.findAll();

            const match = result.find((prompt) => prompt.id === promptWithoutDescription.id);
            expect(match?.description).toBeUndefined();
        });
    });

    describe('findById', () => {
        it('returns a prompt joined with its category by id', async () => {
            const fixturePrompt = await promptFixture.insert({
                categoryId: fitnessCategory.id,
                userId: creatorUser.id,
                title: 'Fixture prompt',
            });

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
            await promptFixture.insert({ categoryId: fitnessCategory.id, userId: creatorUser.id });

            const result = await repository.findById(faker.string.uuid());

            expect(result).toBeUndefined();
        });

        it('returns undefined when the id is not UUID-shaped', async () => {
            await promptFixture.insert({ categoryId: fitnessCategory.id, userId: creatorUser.id });

            const result = await repository.findById('not-a-uuid');

            expect(result).toBeUndefined();
        });

        it('represents a prompt with no description as an absent value', async () => {
            const promptWithoutDescription = await insertPromptWithoutDescription(
                fitnessCategory.id,
            );

            const result = await repository.findById(promptWithoutDescription.id);

            expect(result?.description).toBeUndefined();
        });
    });

    describe('create', () => {
        it('persists a new prompt row', async () => {
            const fixture = promptModelFactory.create({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
            });

            await repository.create(fixture);
            promptFixture.register(fixture.id);
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
        });

        it('persists a prompt with no description as an absent value', async () => {
            const fixture: PromptModel = {
                id: faker.string.uuid(),
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
                title: 'Prompt without description',
                prompt: faker.lorem.paragraph(),
                description: undefined,
                createdAt: faker.date.recent(),
                updatedAt: faker.date.recent(),
            };

            await repository.create(fixture);
            promptFixture.register(fixture.id);
            const [result] = await selectPromptsByIds(db, [fixture.id]);

            expect(result?.description).toBeNull();
        });

        it('persists the creator and resolves it via findById and findAll', async () => {
            const fixture = promptModelFactory.create({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
            });

            await repository.create(fixture);
            promptFixture.register(fixture.id);

            const [persisted] = await selectPromptsByIds(db, [fixture.id]);
            expect(persisted).toMatchObject({ userId: creatorUser.id });

            const foundById = await repository.findById(fixture.id);
            expect(foundById?.user).toEqual({ id: creatorUser.id, name: creatorUser.name });

            const foundInAll = await repository.findAll();
            const match = foundInAll.find((prompt) => prompt.id === fixture.id);
            expect(match?.user).toEqual({ id: creatorUser.id, name: creatorUser.name });
        });
    });

    describe('update', () => {
        it('persists updated fields for an existing prompt row', async () => {
            const existingPrompt = await promptFixture.insert({
                categoryId: travelCategory.id,
                userId: creatorUser.id,
            });

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
        });

        it('persists an updated prompt with no description as an absent value', async () => {
            const existingPrompt = await promptFixture.insert({
                categoryId: travelCategory.id,
                userId: creatorUser.id,
            });

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
        });
    });

    describe('delete', () => {
        it('removes an existing prompt row', async () => {
            const existingPrompt = await promptFixture.insert({
                categoryId: recipeCategory.id,
                userId: creatorUser.id,
            });

            await repository.delete(existingPrompt.id);
            const rows = await selectPromptsByIds(db, [existingPrompt.id]);

            expect(rows).toEqual([]);
        });
    });

    // Built by hand and inserted via repository.create with an explicit undefined
    // description: promptFixture always fills one in through the model factory, but
    // these cases need the description genuinely absent. Registered for cleanup.
    async function insertPromptWithoutDescription(categoryId: string): Promise<PromptModel> {
        const prompt: PromptModel = {
            id: faker.string.uuid(),
            categoryId,
            userId: creatorUser.id,
            title: 'Prompt without description',
            prompt: faker.lorem.paragraph(),
            description: undefined,
            createdAt: faker.date.recent(),
            updatedAt: faker.date.recent(),
        };
        await repository.create(prompt);
        promptFixture.register(prompt.id);
        return prompt;
    }
});
