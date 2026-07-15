import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class MissingTokenError extends DomainError {
    readonly code = 'MISSING_TOKEN';
    readonly category: ErrorCategory = 'Unauthorized';

    constructor() {
        super('No authentication token was provided');
    }
}
