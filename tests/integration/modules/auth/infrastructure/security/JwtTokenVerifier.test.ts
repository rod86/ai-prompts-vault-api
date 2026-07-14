import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import config from '@src/config/config.js';
import { InvalidTokenError } from '@src/modules/auth/domain/errors/InvalidTokenError.js';
import { TokenExpiredError } from '@src/modules/auth/domain/errors/TokenExpiredError.js';
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

        it('rejects with TokenExpiredError when the token has expired', async () => {
            const token = jwt.sign(
                { sub: 'fixture-user-id', exp: Math.floor(Date.now() / 1000) - 10 },
                config.jwtSecret,
                { algorithm: 'HS256' },
            );

            await expect(verifier.verifyToken(token)).rejects.toThrow(TokenExpiredError);
        });

        it('rejects with InvalidTokenError when the signature is not authentic', async () => {
            const token = jwt.sign(
                { sub: 'fixture-user-id', exp: Math.floor(Date.now() / 1000) + 3600 },
                'a-different-secret',
                { algorithm: 'HS256' },
            );

            await expect(verifier.verifyToken(token)).rejects.toThrow(InvalidTokenError);
        });

        it('rejects with InvalidTokenError when the token is unreadable', async () => {
            await expect(verifier.verifyToken('not-a-jwt')).rejects.toThrow(InvalidTokenError);
        });

        it('rejects with InvalidTokenError when the token carries no sub claim', async () => {
            const token = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 3600 }, config.jwtSecret, {
                algorithm: 'HS256',
            });

            await expect(verifier.verifyToken(token)).rejects.toThrow(InvalidTokenError);
        });
    });
});
