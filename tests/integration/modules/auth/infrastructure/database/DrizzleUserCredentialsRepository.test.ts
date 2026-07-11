import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import { DrizzleUserCredentialsRepository } from '@src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { type DatabaseSchema } from '@src/modules/shared/services.js';
import { userModelFactory } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers } from '@tests/lib/database/users.js';

describe('DrizzleUserCredentialsRepository', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, schema);
    let db: ReturnType<typeof client.getConnection>;
    let repository: DrizzleUserCredentialsRepository;
    let insertedIds: string[] = [];

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        repository = new DrizzleUserCredentialsRepository(client);
    });

    afterEach(async () => {
        await deleteUsersByIds(db, insertedIds);
        insertedIds = [];
    });

    afterAll(async () => {
        await client.close();
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
