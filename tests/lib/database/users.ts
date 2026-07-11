import { inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { type User } from '@src/modules/user/domain/User.js';
import { users } from '@src/modules/user/infrastructure/database/schema.js';

export async function insertUsers(
    db: NodePgDatabase<Record<string, unknown>>,
    fixtures: User[],
): Promise<void> {
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

export async function deleteUsersByIds(
    db: NodePgDatabase<Record<string, unknown>>,
    ids: string[],
): Promise<void> {
    if (ids.length === 0) {
        return;
    }

    await db.delete(users).where(inArray(users.id, ids));
}

export async function selectUsersByIds(
    db: NodePgDatabase<Record<string, unknown>>,
    ids: string[],
): Promise<(typeof users.$inferSelect)[]> {
    if (ids.length === 0) {
        return [];
    }

    return db.select().from(users).where(inArray(users.id, ids));
}
