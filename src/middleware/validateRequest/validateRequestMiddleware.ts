import { type NextFunction, type Request, type Response } from 'express';
import { type RequestSchema, validate } from '@src/middleware/validateRequest/validation.js';

export function validateRequestMiddleware<T extends RequestSchema>(
    schema: T,
): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
        const result = validate({ params: req.params, query: req.query, body: req.body }, schema);

        if (!result.valid) {
            res.status(400).json({ message: 'The request was invalid.', errors: result.errors });
            return;
        }

        req.parsedRequest = result.data;
        next();
    };
}
