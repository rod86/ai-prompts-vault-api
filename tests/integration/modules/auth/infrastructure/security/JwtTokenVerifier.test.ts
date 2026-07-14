import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import config from '@src/config/config.js';
import { JwtTokenVerifier } from '@src/modules/auth/infrastructure/security/JwtTokenVerifier.js';

describe('JwtTokenVerifier', () => {
    let verifier: JwtTokenVerifier;

    beforeEach(() => {
        verifier = new JwtTokenVerifier(config.jwtSecret);
    });

    describe('verifyToken', () => {
        it('resolves the user id for a valid, unexpired token', async () => {
            const token = jwt.sign(
                { sub: 'fixture-user-id', exp: Math.floor(Date.now() / 1000) + 3600 },
                config.jwtSecret,
                { algorithm: 'HS256' },
            );

            const result = await verifier.verifyToken(token);

            expect(result).toEqual({ userId: 'fixture-user-id' });
        });
    });
});
