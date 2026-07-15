import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class CategoryNotFoundError extends DomainError {
    readonly code = 'CATEGORY_NOT_FOUND';
    readonly category: ErrorCategory = 'Unprocessable';

    constructor(id: string) {
        super(`Category not found: ${id}`);
    }
}
