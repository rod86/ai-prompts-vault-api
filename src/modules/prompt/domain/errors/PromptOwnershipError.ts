import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class PromptOwnershipError extends DomainError {
    readonly code = 'PROMPT_OWNERSHIP';
    readonly category: ErrorCategory = 'Forbidden';

    constructor(id: string) {
        super(`You are not allowed to modify or delete this prompt: ${id}`);
    }
}
