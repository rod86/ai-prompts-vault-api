import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export class PromptNotFoundError extends DomainError {
    readonly code = 'PROMPT_NOT_FOUND';
    readonly category: ErrorCategory = 'NotFound';

    constructor(id: string) {
        super(`Prompt not found: ${id}`);
    }
}
