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

describe('GET /prompts', () => {
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

    it('returns every prompt with full details, unauthenticated', async () => {
        const first = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
        });
        const second = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
        });

        const response = await request(app).get('/prompts').set('X-Forwarded-For', '10.90.0.1');

        expect(response.status).toBe(200);

        const fixtureIds = [first.id, second.id];
        const entries = response.body.filter((prompt: { id: string }) =>
            fixtureIds.includes(prompt.id),
        );

        expect(entries).toEqual(
            expect.arrayContaining([
                {
                    id: first.id,
                    title: first.title,
                    prompt: first.prompt,
                    description: first.description,
                    category: { id: fixtureCategory.id, name: fixtureCategory.name },
                    user: { id: fixtureUser.id, name: fixtureUser.name },
                    created_at: first.createdAt.toISOString(),
                    updated_at: first.updatedAt.toISOString(),
                },
                {
                    id: second.id,
                    title: second.title,
                    prompt: second.prompt,
                    description: second.description,
                    category: { id: fixtureCategory.id, name: fixtureCategory.name },
                    user: { id: fixtureUser.id, name: fixtureUser.name },
                    created_at: second.createdAt.toISOString(),
                    updated_at: second.updatedAt.toISOString(),
                },
            ]),
        );
    });

    it('returns the collection ordered most-recently-created first', async () => {
        const older = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
            createdAt: new Date('2020-01-01T00:00:00.000Z'),
        });
        const newer = await promptFixture.insert({
            categoryId: fixtureCategory.id,
            userId: fixtureUser.id,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
        });

        const response = await request(app).get('/prompts').set('X-Forwarded-For', '10.90.0.2');

        expect(response.status).toBe(200);

        const fixtureIds = [older.id, newer.id];
        const orderedFixtureIds = response.body
            .map((prompt: { id: string }) => prompt.id)
            .filter((id: string) => fixtureIds.includes(id));

        expect(orderedFixtureIds).toEqual([newer.id, older.id]);
    });
});
