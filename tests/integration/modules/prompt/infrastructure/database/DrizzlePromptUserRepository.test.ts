import { faker } from '@faker-js/faker';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@src/config/drizzle/index.js';
import { DrizzlePromptUserRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptUserRepository.js';
import { createUserFixture, databaseClient } from '@tests/lib/config.js';

describe('DrizzlePromptUserRepository', () => {
    const userFixture = createUserFixture();
    let repository: DrizzlePromptUserRepository;

    beforeAll(() => {
        repository = new DrizzlePromptUserRepository(databaseClient, schema);
    });

    afterEach(async () => {
        await userFixture.cleanup();
    });

    describe('findById', () => {
        it('returns undefined when no user matches the id', async () => {
            const result = await repository.findById(faker.string.uuid());

            expect(result).toBeUndefined();
        });
    });
});
