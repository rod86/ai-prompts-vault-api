import bcrypt from 'bcrypt';
import type PasswordHasherInterface from '@logic/user/domain/interfaces/PasswordHasherInterface.js';

const SALT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasherInterface {
    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }
}
