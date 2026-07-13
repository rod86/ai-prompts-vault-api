import { type NextFunction, type Request, type Response } from 'express';
import { RequestValidationError } from '@src/middleware/validateRequest/RequestValidationError.js';

const errorMiddleware = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof RequestValidationError) {
        res.status(400).json({
            error: err.name,
            message: err.message,
            details: err.details,
        });
        return;
    }

    res.status(500).json({ error: 'InternalServerError', message: 'Internal server error' });
};

export default errorMiddleware;
