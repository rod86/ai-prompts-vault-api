import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import { type User } from '@src/modules/user/domain/User.js';
import {
    createPromptCategoryFixture,
    createPromptFixture,
    createUserFixture,
    databaseClient,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import { selectPromptsByIds } from '@tests/lib/database/prompts.js';
import { createSignedToken } from '@tests/lib/utils.js';

describe('DELETE /prompts/:id', () => {
    const categoryFixture = createPromptCategoryFixture();
    const userFixture = createUserFixture();
    const promptFixture = createPromptFixture();
    let db: TestDatabaseConnection;
    let fixtureCategory: PromptCategory;
    let creatorUser: User;
    let otherUser: User;
    let authToken: string;
    let otherAuthToken: string;

    beforeAll(async () => {
        db = databaseClient.getConnection();
        fixtureCategory = await categoryFixture.insert();
        creatorUser = await userFixture.insert();
        otherUser = await userFixture.insert();
        authToken = createSignedToken({ sub: creatorUser.id });
        otherAuthToken = createSignedToken({ sub: otherUser.id });
    });

    afterEach(async () => {
        await promptFixture.cleanup();
    });

    afterAll(async () => {
        await categoryFixture.cleanup();
        await userFixture.cleanup();
    });

    it('deletes an existing prompt and returns 204 with no body', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

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
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

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
    });

    it('rejects a request with no Authorization header and does not remove the prompt', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const response = await request(app).delete(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(401);

        const persisted = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toHaveLength(1);
    });
});
