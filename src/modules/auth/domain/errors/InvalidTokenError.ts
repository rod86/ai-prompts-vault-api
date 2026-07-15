import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class InvalidTokenError extends DomainError {
    readonly code = 'INVALID_TOKEN';
    readonly category: ErrorCategory = 'Unauthorized';

    constructor() {
        super('Authentication token is invalid');
    }
}
