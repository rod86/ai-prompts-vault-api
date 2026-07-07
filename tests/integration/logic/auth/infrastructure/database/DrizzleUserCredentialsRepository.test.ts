import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DrizzleUserCredentialsRepository } from '@logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import { databaseClient, userModelFactory, type TestDatabaseConnection } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';

describe('DrizzleUserCredentialsRepository', () => {
    let db: TestDatabaseConnection;
    let repository: DrizzleUserCredentialsRepository;
    let insertedIds: string[] = [];

    beforeAll(() => {
        db = databaseClient.connect();
        repository = new DrizzleUserCredentialsRepository(db);
    });

    afterEach(async () => {
        await deleteUsersByIds(db, insertedIds);
        insertedIds = [];
    });

    afterAll(async () => {
        await databaseClient.close();
    });

    describe('findByEmail', () => {
        it('resolves the credentials for a matching email, case-insensitively', async () => {
            const mixedCaseEmail = `Ada.Fixture.${faker.string.uuid()}@Example.com`;
            const fixture = userModelFactory.create({ email: mixedCaseEmail });
            insertedIds = [fixture.id];
            await insertUsers(db, [fixture]);

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
});
