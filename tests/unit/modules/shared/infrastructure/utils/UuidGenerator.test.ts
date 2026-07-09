import { describe, expect, it } from 'vitest';
import { UuidGenerator } from '@src/modules/shared/infrastructure/utils/UuidGenerator.js';

describe('UuidGenerator', () => {
    it('returns a UUID-shaped string', () => {
        const idGenerator = new UuidGenerator();

        const result = idGenerator.generate();

        expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns a different value on each call', () => {
        const idGenerator = new UuidGenerator();

        const first = idGenerator.generate();
        const second = idGenerator.generate();

        expect(first).not.toBe(second);
    });
});
