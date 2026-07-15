import { faker } from '@faker-js/faker';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@src/config/drizzle/index.js';
import { DrizzleUserRepository } from '@src/modules/user/infrastructure/database/DrizzleUserRepository.js';
import {
    createUserFixture,
    databaseClient,
    type TestDatabaseConnection,
    userModelFactory,
} from '@tests/lib/config.js';
import { selectUsersByIds } from '@tests/lib/database/users.js';

describe('DrizzleUserRepository', () => {
    let db: TestDatabaseConnection;
    const userFixture = createUserFixture();
    let repository: DrizzleUserRepository;

    beforeAll(() => {
        db = databaseClient.getConnection();
        repository = new DrizzleUserRepository(databaseClient, schema);
    });

    afterEach(async () => {
        await userFixture.cleanup();
    });

    describe('create', () => {
        it('persists a new account row', async () => {
            const fixture = userModelFactory.create();
            userFixture.register(fixture.id);

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
            const fixture = await userFixture.insert({ email: 'Ada.Fixture@Example.com' });

            const result = await repository.findByEmail('ada.fixture@example.com');

            expect(result).toEqual(fixture);
        });

        it('returns undefined when no account matches the email', async () => {
            const result = await repository.findByEmail(faker.internet.email());

            expect(result).toBeUndefined();
        });
    });
});
