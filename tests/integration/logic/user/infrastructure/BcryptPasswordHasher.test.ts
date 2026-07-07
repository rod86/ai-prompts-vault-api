import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '@logic/user/infrastructure/BcryptPasswordHasher.js';

describe('BcryptPasswordHasher', () => {
    it('produces a verifiable hash, never the plaintext password', async () => {
        const hasher = new BcryptPasswordHasher();

        const result = await hasher.hash('Sup3r$ecret!');

        expect(result).toBeDefined();
        expect(result).not.toBe('Sup3r$ecret!');
        await expect(bcrypt.compare('Sup3r$ecret!', result)).resolves.toBe(true);
    });
});
