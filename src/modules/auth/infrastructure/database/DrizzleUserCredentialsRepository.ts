import { eq, sql } from 'drizzle-orm';
import { type DatabaseConnection, type UserSchema } from '@src/config/drizzle/index.js';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import { type UserCredentials } from '@src/modules/auth/domain/UserCredentials.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';

export class DrizzleUserCredentialsRepository implements UserCredentialsRepositoryInterface {
    constructor(
        private readonly database: DatabaseClientInterface<DatabaseConnection>,
        private readonly schema: UserSchema,
    ) {}

    public async findByEmail(email: string): Promise<UserCredentials | undefined> {
        const db = this.database.getConnection();
        const { users } = this.schema;

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

    public async findById(id: string): Promise<UserCredentials | undefined> {
        const db = this.database.getConnection();
        const { users } = this.schema;

        const rows = await db
            .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        const row = rows[0];

        if (!row) {
            return undefined;
        }

        return { id: row.id, email: row.email, passwordHash: row.passwordHash };
    }
}
