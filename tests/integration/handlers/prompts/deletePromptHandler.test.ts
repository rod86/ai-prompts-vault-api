import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient, type DatabaseSchema } from '@src/modules/shared/services.js';
import { promptCategoryModelFactory, promptModelFactory } from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import { insertPrompts, selectPromptsByIds } from '@tests/lib/database/prompts.js';

describe('DELETE /prompts/:id', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    const fixtureCategory = promptCategoryModelFactory.create();

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory]);
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id]);
        await client.close();
    });

    it('deletes an existing prompt and returns 204 with no body', async () => {
        const fixturePrompt = promptModelFactory.create({ categoryId: fixtureCategory.id });
        await insertPrompts(db, [fixturePrompt]);

        const response = await request(app).delete(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(204);
        expect(response.body).toEqual({});

        const persisted = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toHaveLength(0);
    });

    it('returns a prompt-not-found error when the path id matches no prompt', async () => {
        const unknownId = faker.string.uuid();

        const response = await request(app).delete(`/prompts/${unknownId}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: 'PromptNotFoundError',
            message: `Prompt not found: ${unknownId}`,
        });
    });
});
