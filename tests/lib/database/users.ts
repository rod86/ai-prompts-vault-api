import { eq, inArray } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@src/config/drizzle/index.js';

const { users } = schema;

export async function selectUsersByIds(
    db: NodePgDatabase<Record<string, unknown>>,
    ids: string[],
): Promise<(typeof users.$inferSelect)[]> {
    if (ids.length === 0) {
        return [];
    }

    return db.select().from(users).where(inArray(users.id, ids));
}

export async function selectUsersByEmail(
    db: NodePgDatabase<Record<string, unknown>>,
    email: string,
): Promise<(typeof users.$inferSelect)[]> {
    return db.select().from(users).where(eq(users.email, email));
}
