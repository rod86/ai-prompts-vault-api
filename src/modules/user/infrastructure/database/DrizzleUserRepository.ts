import { sql } from 'drizzle-orm';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { type DatabaseConnection } from '@src/modules/shared/services.js';
import type UserRepositoryInterface from '@src/modules/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@src/modules/user/domain/User.js';
import { users } from '@src/modules/user/infrastructure/database/schema.js';

export class DrizzleUserRepository implements UserRepositoryInterface {
    constructor(private readonly database: DatabaseClientInterface<DatabaseConnection>) {}

    public async findByEmail(email: string): Promise<User | undefined> {
        const db = this.database.getConnection();

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
