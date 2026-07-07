import { sql } from 'drizzle-orm';
import { type DatabaseConnection } from '@logic/shared/database/DatabaseClient.js';
import type UserRepositoryInterface from '@logic/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@logic/user/domain/User.js';
import { users } from '@logic/user/infrastructure/database/schema.js';

export class DrizzleUserRepository implements UserRepositoryInterface {
    constructor(private readonly db: DatabaseConnection) {}

    public async findByEmail(email: string): Promise<User | undefined> {
        const rows = await this.db
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
        await this.db.insert(users).values({
            id: user.id,
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    }
}
