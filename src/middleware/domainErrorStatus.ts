import { type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

export const CATEGORY_STATUS = {
    NotFound: 404,
    Forbidden: 403,
    Unauthorized: 401,
    Unprocessable: 422,
} satisfies Record<ErrorCategory, number>;
