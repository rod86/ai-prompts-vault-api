import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class EmailAlreadyInUseError extends DomainError {
    readonly code = 'EMAIL_ALREADY_IN_USE';
    readonly category: ErrorCategory = 'Unprocessable';

    constructor(email: string) {
        super(`Email already in use: ${email}`);
    }
}
