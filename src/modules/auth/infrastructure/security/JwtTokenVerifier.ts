import jwt from 'jsonwebtoken';
import { InvalidTokenError } from '@src/modules/auth/domain/errors/InvalidTokenError.js';
import { TokenExpiredError } from '@src/modules/auth/domain/errors/TokenExpiredError.js';
import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';

export class JwtTokenVerifier implements TokenVerifierInterface {
    private static readonly ALGORITHM = 'HS256';

    constructor(private readonly secret: string) {}

    public async verifyToken(token: string): Promise<{ userId: string }> {
        try {
            const decoded = jwt.verify(token, this.secret, { algorithms: [JwtTokenVerifier.ALGORITHM] });

            return { userId: (decoded as jwt.JwtPayload).sub as string };
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                throw new TokenExpiredError();
            }

            if (err instanceof jwt.JsonWebTokenError) {
                throw new InvalidTokenError();
            }

            throw err;
        }
    }
}
