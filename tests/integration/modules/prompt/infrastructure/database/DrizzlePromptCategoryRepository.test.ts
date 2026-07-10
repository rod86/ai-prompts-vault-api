import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import config from '@src/config.js';
import { DrizzlePromptCategoryRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { type DatabaseSchema } from '@src/modules/shared/services.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';

describe('DrizzlePromptCategoryRepository', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, config.database.schema);
    let db: ReturnType<typeof client.getConnection>;
    let repository: DrizzlePromptCategoryRepository;

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        repository = new DrizzlePromptCategoryRepository(client);
    });

    afterAll(async () => {
        await client.close();
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

    describe('findById', () => {
        const category = promptCategoryModelFactory.create();

        afterEach(async () => {
            await deletePromptCategoriesByIds(db, [category.id]);
        });

        it('returns the matching category by id', async () => {
            await insertPromptCategories(db, [category]);

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
