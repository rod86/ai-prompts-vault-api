import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { type PromptCategory } from '@src/modules/prompt/domain/PromptCategory.js';
import { type User } from '@src/modules/user/domain/User.js';
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
});
