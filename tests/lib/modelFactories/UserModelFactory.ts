import { faker } from '@faker-js/faker';
import { type User } from '@src/modules/user/domain/User.js';
import { AbstractModelFactory } from '@tests/lib/modelFactories/AbstractModelFactory.js';

export class UserModelFactory extends AbstractModelFactory<User> {
    override create(data: Partial<User> = {}): User {
        return {
            id: data.id ?? faker.string.uuid(),
            name: data.name ?? faker.person.fullName(),
            email: data.email ?? faker.internet.email(),
            passwordHash: data.passwordHash ?? faker.string.alphanumeric(60),
            createdAt: data.createdAt ?? faker.date.past({ years: 2 }),
            updatedAt: data.updatedAt ?? faker.date.recent(),
        };
    }
}
