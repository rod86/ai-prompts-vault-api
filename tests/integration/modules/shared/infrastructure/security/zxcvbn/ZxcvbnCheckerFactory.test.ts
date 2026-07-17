import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import { describe, expect, it } from 'vitest';
import { ZxcvbnCheckerFactory } from '@src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnCheckerFactory.js';

describe('ZxcvbnCheckerFactory', () => {
    it('creates a real ZxcvbnFactory instance', () => {
        const factory = new ZxcvbnCheckerFactory();

        const checker = factory.create();

        expect(checker).toBeInstanceOf(ZxcvbnFactory);
    });
});
