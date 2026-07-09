import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/security/BcryptPasswordHasher.js';

describe('BcryptPasswordHasher', () => {
    it('produces a verifiable hash, never the plaintext password', async () => {
        const hasher = new BcryptPasswordHasher();

        const result = await hasher.hash('Sup3r$ecret!');

        expect(result).toBeDefined();
        expect(result).not.toBe('Sup3r$ecret!');
        await expect(bcrypt.compare('Sup3r$ecret!', result)).resolves.toBe(true);
    });

    describe('compare', () => {
        it('resolves true for a password matching the stored hash', async () => {
            const hasher = new BcryptPasswordHasher();
            const hash = await hasher.hash('Sup3r$ecret!');

            await expect(hasher.compare('Sup3r$ecret!', hash)).resolves.toBe(true);
        });

        it('resolves false for a password not matching the stored hash', async () => {
            const hasher = new BcryptPasswordHasher();
            const hash = await hasher.hash('Sup3r$ecret!');

            await expect(hasher.compare('wrong-password', hash)).resolves.toBe(false);
        });
    });
});
