import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { JwtTokenIssuer } from '@src/modules/auth/infrastructure/JwtTokenIssuer.js';

describe('JwtTokenIssuer', () => {
    let issuer: JwtTokenIssuer;

    beforeEach(() => {
        issuer = new JwtTokenIssuer('test-secret');
    });

    describe('issueToken', () => {
        it('issues a token carrying the user id and an explicit, caller-supplied expiration', async () => {
            const expiresAt = new Date('2026-01-01T01:00:00.000Z');

            const token = await issuer.issueToken('fixture-user-id', expiresAt);

            expect(token).toBeDefined();
            const decoded = jwt.verify(token, 'test-secret', { ignoreExpiration: true });
            expect(decoded).toMatchObject({
                sub: 'fixture-user-id',
                exp: Math.floor(expiresAt.getTime() / 1000),
            });
        });
    });
});
