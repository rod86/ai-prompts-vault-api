import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class InvalidCredentialsError extends DomainError {
    readonly code = 'INVALID_CREDENTIALS';
    readonly category: ErrorCategory = 'Unauthorized';

    constructor() {
        super('Invalid authentication credentials');
    }
}
