import type PasswordStrengthCheckerInterface from '@src/modules/shared/domain/interfaces/PasswordStrengthCheckerInterface.js';

import type { ZxcvbnCheckerFactoryInterface } from './ZxcvbnCheckerTypes.js';

const MIN_STRENGTH_SCORE = 3;

export class ZxcvbnPasswordStrengthChecker implements PasswordStrengthCheckerInterface {
    constructor(private readonly factory: ZxcvbnCheckerFactoryInterface) {}

    public isStrong(password: string): boolean {
        return this.factory.create().check(password).score >= MIN_STRENGTH_SCORE;
    }
}
