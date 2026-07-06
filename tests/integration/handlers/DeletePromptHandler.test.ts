import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import {
    databaseClient,
    promptCategoryModelFactory,
    promptModelFactory,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import { insertPrompts, selectPromptsByIds } from '@tests/lib/database/prompts.js';

describe('DELETE /prompts/:id', () => {
    let db: TestDatabaseConnection;
    const fixtureCategory = promptCategoryModelFactory.create({
        name: 'Delete Prompt Fixture Category',
    });

    beforeAll(async () => {
        db = databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id]);
        await databaseClient.close();
    });

    it('removes the prompt and responds with no content', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);

        const response = await request(app).delete(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(204);
        expect(response.body).toEqual({});
        expect(response.text).toBe('');

        const remaining = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(remaining).toEqual([]);
    });

    it('returns a not-found error when the id matches no prompt', async () => {
        const missingId = faker.string.uuid();

        const response = await request(app).delete(`/prompts/${missingId}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: `Prompt not found: ${missingId}` });
    });

    it('returns a not-found error when deleting an already-deleted id', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);

        const firstResponse = await request(app).delete(`/prompts/${fixturePrompt.id}`);
        expect(firstResponse.status).toBe(204);

        const secondResponse = await request(app).delete(`/prompts/${fixturePrompt.id}`);

        expect(secondResponse.status).toBe(404);
        expect(secondResponse.body).toEqual({ error: `Prompt not found: ${fixturePrompt.id}` });
    });

    describe('Request Validation', () => {
        it('returns an invalid value error for a non-uuid id', async () => {
            const response = await request(app).delete('/prompts/not-a-uuid');

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                errors: expect.arrayContaining([
                    { field: 'params.id', error: 'Invalid UUID value' },
                ]),
            });
        });
    });
});
