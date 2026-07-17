import { describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type {
    ZxcvbnChecker,
    ZxcvbnCheckerFactoryInterface,
} from '@src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnCheckerTypes.js';
import { ZxcvbnPasswordStrengthChecker } from '@src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnPasswordStrengthChecker.js';

describe('ZxcvbnPasswordStrengthChecker', () => {
    it.each([
        [0, false],
        [1, false],
        [2, false],
        [3, true],
        [4, true],
    ])('treats score %i as strong = %s', (score, expected) => {
        const checker: MockProxy<ZxcvbnChecker> = mock<ZxcvbnChecker>();
        checker.check.mockReturnValue({ score });
        const factory: MockProxy<ZxcvbnCheckerFactoryInterface> =
            mock<ZxcvbnCheckerFactoryInterface>();
        factory.create.mockReturnValue(checker);
        const strengthChecker = new ZxcvbnPasswordStrengthChecker(factory);

        const result = strengthChecker.isStrong('any-password');

        expect(result).toBe(expected);
    });
});
