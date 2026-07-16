import { type NextFunction, type Request, type Response } from 'express';
import { ApiError } from '@src/errors/ApiError.js';
import { CATEGORY_STATUS } from '@src/middleware/domainErrorStatus.js';
import { RateLimitExceededError } from '@src/middleware/rateLimit/RateLimitExceededError.js';
import RequestValidationError from '@src/middleware/validateRequest/RequestValidationError.js';
import { DomainError } from '@src/modules/shared/domain/DomainError.js';

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof ApiError) {
        res.status(err.status).json({
            status: err.status,
            code: err.code,
            message: err.message,
            ...(err.details != null && { details: err.details }),
        });
        return;
    }

    if (err instanceof RequestValidationError) {
        res.status(400).json({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details,
        });
        return;
    }

    if (err instanceof RateLimitExceededError) {
        res.status(429).json({ status: 429, code: 'TOO_MANY_REQUESTS', message: err.message });
        return;
    }

    if (err instanceof DomainError) {
        const status = CATEGORY_STATUS[err.category];
        res.status(status).json({ status, code: err.code, message: err.message });
        return;
    }

    console.error(err);
    res.status(500).json({ status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' });
}

export default errorMiddleware;
