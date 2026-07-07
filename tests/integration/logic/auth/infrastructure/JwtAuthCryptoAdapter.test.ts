import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { JwtAuthCryptoAdapter } from '@logic/auth/infrastructure/JwtAuthCryptoAdapter.js';
import type PasswordHasherInterface from '@logic/shared/domain/interfaces/PasswordHasherInterface.js';

describe('JwtAuthCryptoAdapter', () => {
    let passwordHasher: MockProxy<PasswordHasherInterface>;
    let adapter: JwtAuthCryptoAdapter;

    beforeEach(() => {
        passwordHasher = mock<PasswordHasherInterface>();
        adapter = new JwtAuthCryptoAdapter('test-secret', passwordHasher);
    });

    describe('issueToken', () => {
        it('issues a token carrying the user id and an explicit, caller-supplied expiration', async () => {
            const expiresAt = new Date('2026-01-01T01:00:00.000Z');

            const token = await adapter.issueToken('fixture-user-id', expiresAt);

            expect(token).toBeDefined();
            const decoded = jwt.verify(token, 'test-secret', { ignoreExpiration: true });
            expect(decoded).toMatchObject({
                sub: 'fixture-user-id',
                exp: Math.floor(expiresAt.getTime() / 1000),
            });
        });
    });

    describe('verifyPassword', () => {
        it('resolves true for a matching password', async () => {
            passwordHasher.compare.mockResolvedValue(true);

            const result = await adapter.verifyPassword('plaintext', 'stored-hash');

            expect(result).toBe(true);
            expect(passwordHasher.compare).toHaveBeenCalledOnce();
            expect(passwordHasher.compare).toHaveBeenCalledWith('plaintext', 'stored-hash');
        });

        it('resolves false for a non-matching password', async () => {
            passwordHasher.compare.mockResolvedValue(false);

            const result = await adapter.verifyPassword('wrong-password', 'stored-hash');

            expect(result).toBe(false);
        });
    });
});
