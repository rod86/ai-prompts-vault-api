import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import config from '@src/config/config.js';
import { schema, type DatabaseSchema } from '@src/config/drizzle/index.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { databaseClient } from '@src/modules/shared/services.js';
import {
    promptCategoryModelFactory,
    promptModelFactory,
    userModelFactory,
} from '@tests/lib/config.js';
import {
    deletePromptCategoriesByIds,
    insertPromptCategories,
} from '@tests/lib/database/promptCategories.js';
import {
    deletePromptsByIds,
    insertPrompts,
    selectPromptsByIds,
} from '@tests/lib/database/prompts.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';
import { createSignedToken } from '@tests/lib/utils.js';

describe('DELETE /prompts/:id', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    const fixtureCategory = promptCategoryModelFactory.create();
    const creatorUser = userModelFactory.create();
    const otherUser = userModelFactory.create();
    let authToken: string;
    let otherAuthToken: string;

    beforeAll(async () => {
        client.connect();
        db = client.getConnection();
        databaseClient.connect();
        await insertPromptCategories(db, [fixtureCategory]);
        await insertUsers(db, [creatorUser, otherUser]);
        authToken = createSignedToken({ sub: creatorUser.id });
        otherAuthToken = createSignedToken({ sub: otherUser.id });
    });

    afterAll(async () => {
        await deletePromptCategoriesByIds(db, [fixtureCategory.id]);
        await deleteUsersByIds(db, [creatorUser.id, otherUser.id]);
        await client.close();
    });

    it('deletes an existing prompt and returns 204 with no body', async () => {
        const fixturePrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });
        await insertPrompts(db, [fixturePrompt]);

        const response = await request(app)
            .delete(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);
        expect(response.body).toEqual({});

        const persisted = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toHaveLength(0);
    });

    it('returns a prompt-not-found error when the path id matches no prompt', async () => {
        const unknownId = faker.string.uuid();

        const response = await request(app)
            .delete(`/prompts/${unknownId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: 'PromptNotFoundError',
            message: `Prompt not found: ${unknownId}`,
        });
    });

    it('returns an invalid value error for a malformed path id', async () => {
        const response = await request(app)
            .delete('/prompts/not-a-uuid')
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.details.params).toEqual(
            expect.objectContaining({ id: 'Invalid UUID value' }),
        );
    });

    it('rejects a delete from a non-owner as forbidden and does not remove the prompt', async () => {
        const fixturePrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });
        await insertPrompts(db, [fixturePrompt]);

        const response = await request(app)
            .delete(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            error: 'PromptOwnershipError',
            message: `You are not allowed to modify or delete this prompt: ${fixturePrompt.id}`,
        });

        const persisted = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toHaveLength(1);

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });

    it('rejects a request with no Authorization header and does not remove the prompt', async () => {
        const fixturePrompt = promptModelFactory.create({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });
        await insertPrompts(db, [fixturePrompt]);

        const response = await request(app).delete(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(401);

        const persisted = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toHaveLength(1);

        await deletePromptsByIds(db, [fixturePrompt.id]);
    });
});
