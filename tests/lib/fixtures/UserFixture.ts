import { inArray } from 'drizzle-orm';
import { schema } from '@src/config/drizzle/index.js';
import { type User } from '@src/modules/user/domain/User.js';
import { type TestDatabaseClient } from '@tests/lib/config.js';
import { AbstractFixture } from '@tests/lib/fixtures/AbstractFixture.js';
import { type UserModelFactory } from '@tests/lib/modelFactories/UserModelFactory.js';

export class UserFixture extends AbstractFixture<User> {
    constructor(
        databaseClient: TestDatabaseClient,
        private readonly modelFactory: UserModelFactory,
    ) {
        super(databaseClient);
    }

    public async insert(data?: Partial<User>): Promise<User> {
        const user = this.modelFactory.create(data);
        await this.db.insert(schema.users).values(user);
        this.register(user.id);
        return user;
    }

    public async cleanup(): Promise<void> {
        if (this.ids.size === 0) {
            return;
        }

        await this.db.delete(schema.users).where(inArray(schema.users.id, [...this.ids]));
        this.ids.clear();
    }
}
