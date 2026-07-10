import jwt from 'jsonwebtoken';
import type TokenIssuerInterface from '@src/modules/auth/domain/interfaces/TokenIssuerInterface.js';

export class JwtTokenIssuer implements TokenIssuerInterface {
    private static readonly ALGORITHM = 'HS256';

    constructor(private readonly secret: string) {}

    public async issueToken(userId: string, expiresAt: Date): Promise<string> {
        return jwt.sign({ sub: userId, exp: Math.floor(expiresAt.getTime() / 1000) }, this.secret, {
            algorithm: JwtTokenIssuer.ALGORITHM,
        });
    }
}
