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

describe('PUT /prompts/:id', () => {
    const categoryFixture = createPromptCategoryFixture();
    const userFixture = createUserFixture();
    const promptFixture = createPromptFixture();
    let db: TestDatabaseConnection;
    let fixtureCategory: PromptCategory;
    let otherFixtureCategory: PromptCategory;
    let creatorUser: User;
    let otherUser: User;
    let authToken: string;
    let otherAuthToken: string;

    beforeAll(async () => {
        db = databaseClient.getConnection();
        fixtureCategory = await categoryFixture.insert();
        otherFixtureCategory = await categoryFixture.insert();
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

    it('updates a prompt and returns 200 with the stored prompt', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
            description: 'Updated description',
        };

        const response = await request(app)
            .put(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: fixturePrompt.id,
            title: body.title,
            prompt: body.prompt,
            description: body.description,
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            user: { id: creatorUser.id, name: creatorUser.name },
            created_at: expect.any(String),
            updated_at: expect.any(String),
        });
        expect(response.body.created_at).toBe(fixturePrompt.createdAt.toISOString());
        expect(response.body.updated_at).not.toBe(fixturePrompt.updatedAt.toISOString());

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toMatchObject({
            id: fixturePrompt.id,
            promptCategoryId: fixtureCategory.id,
            title: body.title,
            prompt: body.prompt,
            description: body.description,
        });
    });

    it('clears the description when it is omitted from the request', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
            description: 'An existing description',
        });

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
        };

        const response = await request(app)
            .put(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.body.description).toBeNull();

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted?.description).toBeNull();
    });

    it('sets the description to an empty string when submitted as one, instead of clearing it', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
            description: '',
        };

        const response = await request(app)
            .put(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.body.description).toBeNull();

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted?.description).toBe('');
    });

    it('updates the category and echoes the new category when category_id changes', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: otherFixtureCategory.id,
            description: 'Updated description',
        };

        const response = await request(app)
            .put(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.body.category).toEqual({
            id: otherFixtureCategory.id,
            name: otherFixtureCategory.name,
        });

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted?.promptCategoryId).toBe(otherFixtureCategory.id);
    });

    it('returns a prompt-not-found error when the path id matches no prompt', async () => {
        const unknownId = faker.string.uuid();
        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
        };

        const response = await request(app)
            .put(`/prompts/${unknownId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 404,
            code: 'PROMPT_NOT_FOUND',
            message: `Prompt not found: ${unknownId}`,
        });
    });

    it('returns a prompt-not-found error (not category-not-found) when both the prompt and category are missing', async () => {
        const unknownId = faker.string.uuid();
        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: faker.string.uuid(),
        };

        const response = await request(app)
            .put(`/prompts/${unknownId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 404,
            code: 'PROMPT_NOT_FOUND',
            message: `Prompt not found: ${unknownId}`,
        });
    });

    it('returns a category-not-found error when the existing prompt references an unknown category_id', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const unknownCategoryId = faker.string.uuid();
        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: unknownCategoryId,
        };

        const response = await request(app)
            .put(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            error: 'CategoryNotFoundError',
            message: `Category not found: ${unknownCategoryId}`,
        });

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toMatchObject({
            id: fixturePrompt.id,
            promptCategoryId: fixtureCategory.id,
            title: fixturePrompt.title,
            prompt: fixturePrompt.prompt,
            description: fixturePrompt.description,
        });
    });

    it('rejects an update from a non-owner as forbidden and leaves the prompt unchanged', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
        };

        const response = await request(app)
            .put(`/prompts/${fixturePrompt.id}`)
            .set('Authorization', `Bearer ${otherAuthToken}`)
            .send(body);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            error: 'PromptOwnershipError',
            message: `You are not allowed to modify or delete this prompt: ${fixturePrompt.id}`,
        });

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toMatchObject({
            id: fixturePrompt.id,
            title: fixturePrompt.title,
            prompt: fixturePrompt.prompt,
        });
    });

    it('rejects a request with no Authorization header and leaves the prompt unchanged', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: creatorUser.id,
        });

        const body = {
            title: 'Updated title',
            prompt: 'Updated prompt text',
            category_id: fixtureCategory.id,
        };

        const response = await request(app).put(`/prompts/${fixturePrompt.id}`).send(body);

        expect(response.status).toBe(401);

        const [persisted] = await selectPromptsByIds(db, [fixturePrompt.id]);
        expect(persisted).toMatchObject({
            id: fixturePrompt.id,
            title: fixturePrompt.title,
            prompt: fixturePrompt.prompt,
        });
    });

    it('rejects a request with no Authorization header and an invalid body as unauthorized, not as invalid input', async () => {
        const response = await request(app).put(`/prompts/${faker.string.uuid()}`).send({});

        expect(response.status).toBe(401);
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required body fields', async () => {
            const response = await request(app)
                .put(`/prompts/${faker.string.uuid()}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(response.body.details.body).toEqual({
                title: 'Missing required value',
                prompt: 'Missing required value',
                category_id: 'Missing required value',
            });
        });

        it('returns an invalid value error for a malformed path id', async () => {
            const response = await request(app)
                .put('/prompts/not-a-uuid')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(response.body.details.params).toEqual(
                expect.objectContaining({ id: 'Invalid UUID value' }),
            );
        });

        it('returns an invalid value error for a malformed category_id', async () => {
            const response = await request(app)
                .put(`/prompts/${faker.string.uuid()}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Updated title',
                    prompt: 'Updated prompt text',
                    category_id: 'not-a-uuid',
                });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ category_id: 'Invalid UUID value' }),
            );
        });
    });
});
