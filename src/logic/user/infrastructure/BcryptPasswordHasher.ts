import bcrypt from 'bcrypt';
import type PasswordHasherInterface from '@logic/user/domain/interfaces/PasswordHasherInterface.js';

export class BcryptPasswordHasher implements PasswordHasherInterface {
    private static readonly SALT_ROUNDS = 10;

    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, BcryptPasswordHasher.SALT_ROUNDS);
    }
}
