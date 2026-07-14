import jwt from 'jsonwebtoken';
import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';

export class JwtTokenVerifier implements TokenVerifierInterface {
    private static readonly ALGORITHM = 'HS256';

    constructor(private readonly secret: string) {}

    public async verifyToken(token: string): Promise<{ userId: string }> {
        const decoded = jwt.verify(token, this.secret, { algorithms: [JwtTokenVerifier.ALGORITHM] });

        return { userId: (decoded as jwt.JwtPayload).sub as string };
    }
}
