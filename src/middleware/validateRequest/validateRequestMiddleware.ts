import { type RequestHandler } from 'express';
import { type RequestSchema, validator } from '@src/middleware/validateRequest/validator.js';

const validateRequestMiddleware = (schema: RequestSchema): RequestHandler => {
    return (req, res, next) => {
        const result = validator(schema, {
            params: req.params,
            query: req.query,
            body: req.body,
        });

        if (!result.success) {
            next();
            return;
        }

        req.parsedRequest = result.data;
        next();
    };
};

export default validateRequestMiddleware;
