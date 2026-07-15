import { faker } from '@faker-js/faker';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@src/config/drizzle/index.js';
import { DrizzlePromptCategoryRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import { createPromptCategoryFixture, databaseClient } from '@tests/lib/config.js';

describe('DrizzlePromptCategoryRepository', () => {
    const categoryFixture = createPromptCategoryFixture();
    let repository: DrizzlePromptCategoryRepository;

    beforeAll(() => {
        repository = new DrizzlePromptCategoryRepository(databaseClient, schema);
    });

    afterEach(async () => {
        await categoryFixture.cleanup();
    });

    describe('findAll', () => {
        it('returns the inserted categories ordered alphabetically by name ascending', async () => {
            const writing = await categoryFixture.insert({ name: 'Writing & Content' });
            const business = await categoryFixture.insert({ name: 'Business & Finance' });
            const coding = await categoryFixture.insert({ name: 'Coding & Development' });

            const result = await repository.findAll();

            const fixtureIds = new Set([writing.id, business.id, coding.id]);
            const fixturesInResult = result.filter((category) => fixtureIds.has(category.id));

            expect(fixturesInResult).toEqual([business, coding, writing]);
        });
    });

    describe('findById', () => {
        it('returns the matching category by id', async () => {
            const category = await categoryFixture.insert();

            const result = await repository.findById(category.id);

            expect(result).toEqual({ id: category.id, name: category.name });
        });

        it('returns undefined when no category matches the id', async () => {
            const result = await repository.findById(faker.string.uuid());

            expect(result).toBeUndefined();
        });

        it('returns undefined when the id is not UUID-shaped', async () => {
            const result = await repository.findById('not-a-uuid');

            expect(result).toBeUndefined();
        });
    });
});
