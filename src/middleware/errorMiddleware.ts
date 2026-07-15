import { type NextFunction, type Request, type Response } from 'express';
import { CATEGORY_STATUS } from '@src/middleware/domainErrorStatus.js';
import RequestValidationError from '@src/middleware/validateRequest/RequestValidationError.js';
import { InvalidCredentialsError } from '@src/modules/auth/domain/errors/InvalidCredentialsError.js';
import { InvalidTokenError } from '@src/modules/auth/domain/errors/InvalidTokenError.js';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { TokenExpiredError } from '@src/modules/auth/domain/errors/TokenExpiredError.js';
import { DomainError } from '@src/modules/shared/domain/DomainError.js';

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof RequestValidationError) {
        res.status(400).json({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details,
        });
        return;
    }

    if (err instanceof MissingTokenError) {
        res.status(401).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof TokenExpiredError) {
        res.status(401).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof InvalidTokenError) {
        res.status(401).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: err.name, message: err.message });
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
