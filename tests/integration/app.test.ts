import { faker } from '@faker-js/faker';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type PromptCategory } from '@logic/prompt/domain/PromptCategory.js';
import { databaseClient } from '@logic/shared/services.js';
import app from '@src/app.js';
import {
    deletePromptCategoriesByIds,
    getAllPromptCategories,
    insertPromptCategories,
} from '@tests/lib/seeding/promptCategories.js';

const FIXTURE_CATEGORIES: PromptCategory[] = [
    { id: faker.string.uuid(), name: 'Zzz Topic' },
    { id: faker.string.uuid(), name: 'Aaa Topic' },
];

describe('GET /categories', () => {
    let db: NodePgDatabase<Record<string, unknown>>;

    beforeAll(() => {
        db = databaseClient.connect();
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    afterEach(async () => {
        await deletePromptCategoriesByIds(
            db,
            FIXTURE_CATEGORIES.map((category) => category.id),
        );
    });

    it('returns all categories ordered alphabetically by name', async () => {
        await insertPromptCategories(db, FIXTURE_CATEGORIES);
        const existingCategories = await getAllPromptCategories(db);
        const expected = [...existingCategories].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );

        const response = await request(app).get('/categories');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expected.map((category) => ({ id: category.id, name: category.name })),
        );
    });
});
