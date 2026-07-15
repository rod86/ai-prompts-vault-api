import { sql } from 'drizzle-orm';
import { type DatabaseConnection, type UserSchema } from '@src/config/drizzle/index.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import type UserRepositoryInterface from '@src/modules/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@src/modules/user/domain/User.js';

export class DrizzleUserRepository implements UserRepositoryInterface {
    constructor(
        private readonly database: DatabaseClientInterface<DatabaseConnection>,
        private readonly schema: UserSchema,
    ) {}

    public async findByEmail(email: string): Promise<User | undefined> {
        const db = this.database.getConnection();
        const { users } = this.schema;

        const rows = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = lower(${email})`)
            .limit(1);

        const row = rows[0];

        if (!row) {
            return undefined;
        }

        return {
            id: row.id,
            name: row.name,
            email: row.email,
            passwordHash: row.passwordHash,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    public async create(user: User): Promise<void> {
        const db = this.database.getConnection();
        const { users } = this.schema;

        await db.insert(users).values({
            id: user.id,
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    }
}
