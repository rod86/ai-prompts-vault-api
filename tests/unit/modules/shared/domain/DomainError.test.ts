import { describe, expect, it } from 'vitest';
import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

class StubDomainError extends DomainError {
    readonly code = 'X';
    readonly category: ErrorCategory = 'NotFound';
}

describe('DomainError', () => {
    it('sets name from the subclass, preserves the message, and exposes code/category', () => {
        const error = new StubDomainError('boom');

        expect(error.name).toBe('StubDomainError');
        expect(error.message).toBe('boom');
        expect(error.code).toBe('X');
        expect(error.category).toBe('NotFound');
    });

    it('forwards a supplied cause', () => {
        const cause = new Error('root cause');

        const error = new StubDomainError('boom', { cause });

        expect(error.cause).toBe(cause);
    });
});
