import { inArray } from 'drizzle-orm';
import { type User } from '@logic/user/domain/User.js';
import { users } from '@logic/user/infrastructure/database/schema.js';
import { type TestDatabaseConnection } from '@tests/lib/config.js';

export async function insertUsers(db: TestDatabaseConnection, fixtures: User[]): Promise<void> {
    if (fixtures.length === 0) {
        return;
    }

    await db.insert(users).values(
        fixtures.map((fixture) => ({
            id: fixture.id,
            name: fixture.name,
            email: fixture.email,
            passwordHash: fixture.passwordHash,
            createdAt: fixture.createdAt,
            updatedAt: fixture.updatedAt,
        })),
    );
}

export async function deleteUsersByIds(db: TestDatabaseConnection, ids: string[]): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(users).where(inArray(users.id, ids));
}

export async function selectUsersByIds(
    db: TestDatabaseConnection,
    ids: string[],
): Promise<(typeof users.$inferSelect)[]> {
    if (ids.length === 0) {
        return [];
    }

    return db.select().from(users).where(inArray(users.id, ids));
}
