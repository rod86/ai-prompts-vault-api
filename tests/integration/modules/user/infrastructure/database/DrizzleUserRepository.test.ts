import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import config from '@src/config.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { type DatabaseSchema } from '@src/modules/shared/services.js';
import { DrizzleUserRepository } from '@src/modules/user/infrastructure/database/DrizzleUserRepository.js';
import { userModelFactory } from '@tests/lib/config.js';
import { deleteUsersByIds, insertUsers, selectUsersByIds } from '@tests/lib/database/users.js';

describe('DrizzleUserRepository', () => {
    const client = new DatabaseClient<DatabaseSchema>(config.database, config.database.schema);
    let db: ReturnType<typeof client.getConnection>;
    let repository: DrizzleUserRepository;
    let insertedIds: string[] = [];

    beforeAll(() => {
        client.connect();
        db = client.getConnection();
        repository = new DrizzleUserRepository(client);
    });

    afterEach(async () => {
        await deleteUsersByIds(db, insertedIds);
        insertedIds = [];
    });

    afterAll(async () => {
        await client.close();
    });

    describe('create', () => {
        it('persists a new account row', async () => {
            const fixture = userModelFactory.create();
            insertedIds = [fixture.id];

            await repository.create(fixture);

            const rows = await selectUsersByIds(db, [fixture.id]);
            expect(rows).toEqual([
                {
                    id: fixture.id,
                    name: fixture.name,
                    email: fixture.email,
                    passwordHash: fixture.passwordHash,
                    createdAt: fixture.createdAt,
                    updatedAt: fixture.updatedAt,
                },
            ]);
        });
    });

    describe('findByEmail', () => {
        it('finds an account by email, case-insensitively', async () => {
            const fixture = userModelFactory.create({ email: 'Ada.Fixture@Example.com' });
            insertedIds = [fixture.id];
            await insertUsers(db, [fixture]);

            const result = await repository.findByEmail('ada.fixture@example.com');

            expect(result).toEqual(fixture);
        });

        it('returns undefined when no account matches the email', async () => {
            const result = await repository.findByEmail(faker.internet.email());

            expect(result).toBeUndefined();
        });
    });
});
