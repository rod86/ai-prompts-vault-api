import { faker } from '@faker-js/faker';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@src/config/drizzle/index.js';
import { DrizzleUserCredentialsRepository } from '@src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import { createUserFixture, databaseClient } from '@tests/lib/config.js';

describe('DrizzleUserCredentialsRepository', () => {
    const userFixture = createUserFixture();
    let repository: DrizzleUserCredentialsRepository;

    beforeAll(() => {
        repository = new DrizzleUserCredentialsRepository(databaseClient, schema);
    });

    afterEach(async () => {
        await userFixture.cleanup();
    });

    describe('findByEmail', () => {
        it('resolves the credentials for a matching email, case-insensitively', async () => {
            const mixedCaseEmail = `Ada.Fixture.${faker.string.uuid()}@Example.com`;
            const fixture = await userFixture.insert({ email: mixedCaseEmail });

            const result = await repository.findByEmail(mixedCaseEmail.toLowerCase());

            expect(result).toEqual({
                id: fixture.id,
                email: fixture.email,
                passwordHash: fixture.passwordHash,
            });
        });

        it('resolves undefined for an email with no matching account', async () => {
            const result = await repository.findByEmail(faker.internet.email());

            expect(result).toBeUndefined();
        });
    });

    describe('findById', () => {
        it('resolves the credentials for a matching id', async () => {
            const fixture = await userFixture.insert();

            const result = await repository.findById(fixture.id);

            expect(result).toEqual({
                id: fixture.id,
                email: fixture.email,
                passwordHash: fixture.passwordHash,
            });
        });

        it('resolves undefined for an id with no matching account', async () => {
            const result = await repository.findById(faker.string.uuid());

            expect(result).toBeUndefined();
        });
    });
});
