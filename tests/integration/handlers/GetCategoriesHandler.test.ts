import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import {
    databaseClient,
    promptCategoryModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';

describe('GET /categories', () => {
    let db: TestDatabaseConnection;

    beforeAll(async () => {
        db = databaseClient.connect();
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    const fixtureCategories = [
        promptCategoryModelFactory.create({ name: 'Zzz Topic' }),
        promptCategoryModelFactory.create({ name: 'Aaa Topic' }),
    ];

    afterEach(async () => {
        await deletePromptCategoriesByIds(
            db,
            fixtureCategories.map((category) => category.id),
        );
    });

    it('returns all categories ordered alphabetically by name', async () => {
        await insertPromptCategories(db, fixtureCategories);

        const response = await request(app).get('/categories');

        const fixtureIds = new Set(fixtureCategories.map((category) => category.id));
        const fixturesInResponse = (response.body as Array<{ id: string; name: string }>).filter(
            (category) => fixtureIds.has(category.id),
        );

        expect(response.status).toBe(200);
        expect(fixturesInResponse).toEqual(
            [...fixtureCategories]
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                .map((category) => ({ id: category.id, name: category.name })),
        );
    });
});
