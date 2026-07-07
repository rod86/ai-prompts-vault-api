import jwt from 'jsonwebtoken';
import type AuthCryptoInterface from '@logic/auth/domain/interfaces/AuthCryptoInterface.js';
import type PasswordHasherInterface from '@logic/shared/domain/interfaces/PasswordHasherInterface.js';

export class JwtAuthCryptoAdapter implements AuthCryptoInterface {
    private static readonly ALGORITHM = 'HS256';

    constructor(
        private readonly secret: string,
        private readonly passwordHasher: PasswordHasherInterface,
    ) {}

    public async issueToken(userId: string, expiresAt: Date): Promise<string> {
        return jwt.sign({ sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) }, this.secret, {
            algorithm: JwtAuthCryptoAdapter.ALGORITHM,
        });
    }

    public async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
        return this.passwordHasher.compare(password, passwordHash);
    }
}
