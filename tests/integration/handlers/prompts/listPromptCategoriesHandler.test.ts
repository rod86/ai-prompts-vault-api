import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { createPromptCategoryFixture } from '@tests/lib/config.js';

describe('GET /prompt-categories', () => {
    const categoryFixture = createPromptCategoryFixture();

    afterEach(async () => {
        await categoryFixture.cleanup();
    });

    describe('when categories exist', () => {
        it('returns all categories ordered alphabetically by name ascending', async () => {
            const banana = await categoryFixture.insert({ name: 'Banana' });
            const apple = await categoryFixture.insert({ name: 'apple' });
            const cherry = await categoryFixture.insert({ name: 'cherry' });

            const response = await request(app).get('/prompt-categories');

            expect(response.status).toBe(200);

            const fixtureIds = [banana.id, apple.id, cherry.id];
            const fixturesInResponse = response.body.filter(
                (category: { id: string }) => fixtureIds.includes(category.id)
            );

            expect(fixturesInResponse).toEqual([apple, banana, cherry]);
        });
    });
});
