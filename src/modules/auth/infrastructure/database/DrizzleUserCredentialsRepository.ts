import { sql } from 'drizzle-orm';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import { type UserCredentials } from '@src/modules/auth/domain/UserCredentials.js';
import { users } from '@src/modules/auth/infrastructure/database/schema.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { type DatabaseConnection } from '@src/modules/shared/services.js';

export class DrizzleUserCredentialsRepository implements UserCredentialsRepositoryInterface {
    constructor(private readonly database: DatabaseClientInterface<DatabaseConnection>) {}

    public async findByEmail(email: string): Promise<UserCredentials | undefined> {
        const db = this.database.getConnection();

        const rows = await db
            .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
            .from(users)
            .where(sql`lower(${users.email}) = lower(${email})`)
            .limit(1);

        const row = rows[0];

        if (!row) {
            return undefined;
        }

        return { id: row.id, email: row.email, passwordHash: row.passwordHash };
    }
}
