import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class WeakPasswordError extends DomainError {
    readonly code = 'WEAK_PASSWORD';
    readonly category: ErrorCategory = 'Unprocessable';

    constructor() {
        super('Password is too weak');
    }
}
