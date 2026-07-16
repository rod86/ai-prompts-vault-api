import { faker } from '@faker-js/faker';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '@src/app.js';
import { type User } from '@src/modules/user/domain/User.js';
import { PromptResponseSchema } from '@src/routes/prompts.response.schema.js';
import {
    createPromptCategoryFixture,
    createPromptFixture,
    createUserFixture,
    databaseClient,
    type TestDatabaseConnection,
} from '@tests/lib/config.js';
import { selectPromptsByCategoryId, selectPromptsByIds } from '@tests/lib/database/prompts.js';
import { createSignedToken } from '@tests/lib/utils.js';

describe('POST /prompts', () => {
    const userFixture = createUserFixture();
    const categoryFixture = createPromptCategoryFixture();
    const promptFixture = createPromptFixture();
    let db: TestDatabaseConnection;
    let creatorUser: User;
    let authToken: string;

    beforeAll(async () => {
        db = databaseClient.getConnection();
        creatorUser = await userFixture.insert();
        authToken = createSignedToken({ sub: creatorUser.id });
    });

    afterEach(async () => {
        await promptFixture.cleanup();
        await categoryFixture.cleanup();
    });

    afterAll(async () => {
        await userFixture.cleanup();
    });

    it('rejects a request with no Authorization header and creates no prompt', async () => {
        const category = await categoryFixture.insert();
        const body = {
            title: 'My prompt title',
            prompt: 'My prompt text',
            category_id: category.id,
        };

        const response = await request(app).post('/prompts').send(body);

        expect(response.status).toBe(401);
        const stored = await selectPromptsByCategoryId(db, category.id);
        expect(stored).toEqual([]);
    });

    it('rejects an unauthenticated request with an invalid body as unauthorized, not as invalid input', async () => {
        const response = await request(app).post('/prompts').send({});

        expect(response.status).toBe(401);
    });

    describe('when the category exists', () => {
        it('creates a prompt and returns 201 with the stored prompt', async () => {
            const category = await categoryFixture.insert();
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
                description: 'My prompt description',
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            promptFixture.register(response.body.id);
            expect(response.status).toBe(201);
            expect(response.body).toEqual({
                id: expect.any(String),
                title: body.title,
                prompt: body.prompt,
                description: body.description,
                category: { id: category.id, name: category.name },
                user: { id: creatorUser.id, name: creatorUser.name },
                created_at: expect.any(String),
                updated_at: expect.any(String),
            });
            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted).toMatchObject({
                id: response.body.id,
                promptCategoryId: category.id,
                userId: creatorUser.id,
                title: body.title,
                prompt: body.prompt,
                description: body.description,
            });
        });

        it('response matches the documented shape', async () => {
            const category = await categoryFixture.insert();
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
                description: 'My prompt description',
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            promptFixture.register(response.body.id);
            expect(() => PromptResponseSchema.parse(response.body)).not.toThrow();
        });

        it('returns description: null and stores it as null when not submitted', async () => {
            const category = await categoryFixture.insert();
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            promptFixture.register(response.body.id);
            expect(response.body.description).toBeNull();

            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted?.description).toBeNull();
        });

        it('returns description: null and stores it as empty text when submitted as empty', async () => {
            const category = await categoryFixture.insert();
            const body = {
                title: 'My prompt title',
                prompt: 'My prompt text',
                category_id: category.id,
                description: '',
            };

            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(body);

            promptFixture.register(response.body.id);
            expect(response.body.description).toBeNull();

            const [persisted] = await selectPromptsByIds(db, [response.body.id]);
            expect(persisted?.description).toBe('');
        });
    });

    it('returns a category-invalid error when category_id matches no category', async () => {
        const unknownCategoryId = faker.string.uuid();
        const body = {
            title: 'My prompt title',
            prompt: 'My prompt text',
            category_id: unknownCategoryId,
        };

        const response = await request(app)
            .post('/prompts')
            .set('Authorization', `Bearer ${authToken}`)
            .send(body);

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            status: 422,
            code: 'CATEGORY_NOT_FOUND',
            message: `Category not found: ${unknownCategoryId}`,
        });

        const stored = await selectPromptsByCategoryId(db, unknownCategoryId);
        expect(stored).toEqual([]);
    });

    describe('Request Validation', () => {
        it('returns missing required value errors for all required fields', async () => {
            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(response.body.details.body).toEqual({
                title: 'Missing required value',
                prompt: 'Missing required value',
                category_id: 'Missing required value',
            });
        });

        it('returns an invalid value error for a non-uuid category_id', async () => {
            const response = await request(app)
                .post('/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    category_id: '12345',
                });

            expect(response.body.details.body).toEqual(
                expect.objectContaining({ category_id: 'Invalid UUID value' }),
            );
        });
    });
});
