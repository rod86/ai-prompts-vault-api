import { type NextFunction, type Request, type Response } from 'express';
import RequestValidationError from '@src/middleware/validateRequest/RequestValidationError.js';
import { CategoryNotFoundError } from '@src/modules/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof RequestValidationError) {
        res.status(400).json({ error: err.name, message: err.message, details: err.details });
        return;
    }

    if (err instanceof PromptNotFoundError) {
        res.status(404).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof CategoryNotFoundError) {
        res.status(422).json({ error: err.name, message: err.message });
        return;
    }

    res.status(500).json({ error: 'InternalServerError', message: 'Internal server error' });
}

export default errorMiddleware;
