import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import { schema, type DatabaseSchema } from '@src/config/drizzle/index.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient } from '@src/modules/shared/services.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';

describe('GET /prompt-categories', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
    });

    afterAll(async () => {
        await client.close();
    });

    describe('when categories exist', () => {
        const categories = [
            promptCategoryModelFactory.create({ name: 'Banana' }),
            promptCategoryModelFactory.create({ name: 'apple' }),
            promptCategoryModelFactory.create({ name: 'cherry' }),
        ];

        afterEach(async () => {
            await deletePromptCategoriesByIds(
                db,
                categories.map((category) => category.id),
            );
        });

        it('returns all categories ordered alphabetically by name ascending', async () => {
            await insertPromptCategories(db, categories);

            const response = await request(app).get('/prompt-categories');

            expect(response.status).toBe(200);
            const fixtureIds = new Set(categories.map((category) => category.id));
            const fixturesInResponse = response.body.filter((category: { id: string }) =>
                fixtureIds.has(category.id),
            );
            expect(fixturesInResponse).toEqual([categories[1], categories[0], categories[2]]);
        });
    });
});
