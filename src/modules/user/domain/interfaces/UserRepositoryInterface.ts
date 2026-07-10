import { type User } from '@src/modules/user/domain/User.js';

export default interface UserRepositoryInterface {
    findByEmail(email: string): Promise<User | undefined>;
    create(user: User): Promise<void>;
}
