import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DrizzlePromptCategoryRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import {
    databaseClient,
    promptCategoryModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';

describe('DrizzlePromptCategoryRepository', () => {
    let db: TestDatabaseConnection;
    let repository: DrizzlePromptCategoryRepository;

    beforeAll(() => {
        db = databaseClient.connect();
        repository = new DrizzlePromptCategoryRepository(db);
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    describe('findAll', () => {
        const categories = [
            promptCategoryModelFactory.create({ name: 'Writing & Content' }),
            promptCategoryModelFactory.create({ name: 'Business & Finance' }),
            promptCategoryModelFactory.create({ name: 'Coding & Development' }),
        ];
        afterEach(async () => {
            await deletePromptCategoriesByIds(
                db,
                categories.map((category) => category.id),
            );
        });

        it('returns the inserted categories ordered alphabetically by name ascending', async () => {
            await insertPromptCategories(db, categories);

            const result = await repository.findAll();

            const fixtureIds = new Set(categories.map((category) => category.id));
            const fixturesInResult = result.filter((category) => fixtureIds.has(category.id));

            expect(fixturesInResult).toEqual([categories[1], categories[2], categories[0]]);
        });
    });
});
