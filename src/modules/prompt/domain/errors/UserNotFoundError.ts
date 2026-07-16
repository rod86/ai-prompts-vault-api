import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class UserNotFoundError extends DomainError {
    readonly code = 'USER_NOT_FOUND';
    readonly category: ErrorCategory = 'Unprocessable';

    constructor(id: string) {
        super(`User not found: ${id}`);
    }
}
