import { type UserCredentials } from '@logic/auth/domain/UserCredentials.js';

export default interface UserCredentialsRepositoryInterface {
    findByEmail(email: string): Promise<UserCredentials | undefined>;
}
