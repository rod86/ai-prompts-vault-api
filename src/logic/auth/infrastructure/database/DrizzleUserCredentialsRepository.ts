import type UserCredentialsRepositoryInterface from '@logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import { type UserCredentials } from '@logic/auth/domain/UserCredentials.js';
import { type DatabaseConnection } from '@logic/shared/database/DatabaseClient.js';
import type config from '@src/config.js';

export class DrizzleUserCredentialsRepository implements UserCredentialsRepositoryInterface {
    constructor(private readonly db: DatabaseConnection<typeof config.database.schema>) {}

    public async findByEmail(email: string): Promise<UserCredentials | undefined> {
        const row = await this.db.query.users.findFirst({
            where: (users, { sql }) => sql`lower(${users.email}) = lower(${email})`,
        });

        if (!row) {
            return undefined;
        }

        return { id: row.id, email: row.email, passwordHash: row.passwordHash };
    }
}
