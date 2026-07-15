import { type NextFunction, type Request, type Response } from 'express';
import RequestValidationError from '@src/middleware/validateRequest/RequestValidationError.js';
import { InvalidCredentialsError } from '@src/modules/auth/domain/errors/InvalidCredentialsError.js';
import { InvalidTokenError } from '@src/modules/auth/domain/errors/InvalidTokenError.js';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { TokenExpiredError } from '@src/modules/auth/domain/errors/TokenExpiredError.js';
import { CategoryNotFoundError } from '@src/modules/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import { PromptOwnershipError } from '@src/modules/prompt/domain/errors/PromptOwnershipError.js';
import { EmailAlreadyInUseError } from '@src/modules/user/domain/errors/EmailAlreadyInUseError.js';

function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof RequestValidationError) {
        res.status(400).json({ error: err.name, message: err.message, details: err.details });
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

    if (err instanceof PromptNotFoundError) {
        res.status(404).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof PromptOwnershipError) {
        res.status(403).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof CategoryNotFoundError) {
        res.status(422).json({ error: err.name, message: err.message });
        return;
    }

    if (err instanceof EmailAlreadyInUseError) {
        res.status(422).json({ error: err.name, message: err.message });
        return;
    }

    res.status(500).json({ error: 'InternalServerError', message: 'Internal server error' });
}

export default errorMiddleware;
