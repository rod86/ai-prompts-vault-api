import { describe, expect, it } from 'vitest';
import { DateTimeService } from '@src/modules/shared/infrastructure/utils/DateTimeService.js';

describe('DateTimeService', () => {
    it('returns the current time', () => {
        const dateService = new DateTimeService();
        const before = Date.now();

        const result = dateService.now();

        const after = Date.now();
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
    });
});
