import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class TokenExpiredError extends DomainError {
    readonly code = 'TOKEN_EXPIRED';
    readonly category: ErrorCategory = 'Unauthorized';

    constructor() {
        super('Authentication token has expired');
    }
}
