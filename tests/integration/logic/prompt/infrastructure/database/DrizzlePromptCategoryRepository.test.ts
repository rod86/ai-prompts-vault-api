import { faker } from '@faker-js/faker';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { DrizzlePromptCategoryRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import { databaseClient } from '@logic/shared/services.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';

const FIXTURE_CATEGORIES: PromptCategory[] = [
    { id: faker.string.uuid(), name: 'Writing & Content' },
    { id: faker.string.uuid(), name: 'Business & Finance' },
    { id: faker.string.uuid(), name: 'Coding & Development' },
];

describe('DrizzlePromptCategoryRepository', () => {
    let db: NodePgDatabase<Record<string, unknown>>;
    let repository: DrizzlePromptCategoryRepository;

    beforeAll(() => {
        db = databaseClient.connect();
        repository = new DrizzlePromptCategoryRepository(db);
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    describe('findAll', () => {
        afterEach(async () => {
            await deletePromptCategoriesByIds(
                db,
                FIXTURE_CATEGORIES.map((category) => category.id),
            );
        });

        it('returns the inserted categories ordered alphabetically by name ascending', async () => {
            await insertPromptCategories(db, FIXTURE_CATEGORIES);

            const result = await repository.findAll();

            const fixtureIds = new Set(FIXTURE_CATEGORIES.map((category) => category.id));
            const fixturesInResult = result.filter((category) => fixtureIds.has(category.id));

            expect(fixturesInResult).toEqual([
                { id: FIXTURE_CATEGORIES[1]?.id, name: 'Business & Finance' },
                { id: FIXTURE_CATEGORIES[2]?.id, name: 'Coding & Development' },
                { id: FIXTURE_CATEGORIES[0]?.id, name: 'Writing & Content' },
            ]);
        });
    });
});
