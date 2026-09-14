import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import { type User } from '@src/modules/user/domain/User.js';
import { PromptResponseSchema } from '@src/routes/prompts/prompts.response.schema.js';
import {
    createPromptCategoryFixture,
    createPromptFixture,
    createUserFixture,
} from '@tests/lib/config.js';

describe('GET /prompts/:id', () => {
    const categoryFixture = createPromptCategoryFixture();
    const userFixture = createUserFixture();
    const promptFixture = createPromptFixture();
    let fixtureCategory: PromptCategory;
    let fixtureUser: User;

    beforeAll(async () => {
        fixtureCategory = await categoryFixture.insert();
        fixtureUser = await userFixture.insert();
    });

    afterEach(async () => {
        await promptFixture.cleanup();
    });

    afterAll(async () => {
        await categoryFixture.cleanup();
        await userFixture.cleanup();
    });

    it('returns the full prompt details without requiring credentials', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
        });

        const response = await request(app).get(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: fixturePrompt.id,
            title: fixturePrompt.title,
            prompt: fixturePrompt.prompt,
            description: fixturePrompt.description,
            category: { id: fixtureCategory.id, name: fixtureCategory.name },
            user: { id: fixtureUser.id, name: fixtureUser.name },
            created_at: fixturePrompt.createdAt.toISOString(),
            updated_at: fixturePrompt.updatedAt.toISOString(),
        });
    });

    it('response matches the documented shape', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
        });

        const response = await request(app).get(`/prompts/${fixturePrompt.id}`);

        expect(() => PromptResponseSchema.parse(response.body)).not.toThrow();
    });

    it('reports an empty description when the prompt has none', async () => {
        const fixturePrompt = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
            description: undefined,
        });

        const response = await request(app).get(`/prompts/${fixturePrompt.id}`);

        expect(response.status).toBe(200);
        expect(response.body.description).toBeNull();
    });

    it('returns a prompt-not-found error when the path id matches no prompt', async () => {
        const unknownId = faker.string.uuid();

        const response = await request(app).get(`/prompts/${unknownId}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 404,
            code: 'PROMPT_NOT_FOUND',
            message: `Prompt not found: ${unknownId}`,
        });
    });
});
