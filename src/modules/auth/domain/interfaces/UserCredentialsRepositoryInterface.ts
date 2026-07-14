import { type UserCredentials } from '@src/modules/auth/domain/UserCredentials.js';

export default interface UserCredentialsRepositoryInterface {
    findByEmail(email: string): Promise<UserCredentials | undefined>;
    findById(id: string): Promise<UserCredentials | undefined>;
}
