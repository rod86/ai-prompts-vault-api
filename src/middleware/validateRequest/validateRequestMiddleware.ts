import { type RequestHandler } from 'express';
import RequestValidationError from '@src/middleware/validateRequest/RequestValidationError.js';
import validator, { type RequestSchema } from '@src/middleware/validateRequest/validator.js';

function validateRequestMiddleware(schema: RequestSchema): RequestHandler {
    return (req, _res, next) => {
        const result = validator(schema, { params: req.params, query: req.query, body: req.body });

        if (!result.success) {
            throw new RequestValidationError(result.errors);
        }

        req.parsedRequest = result.data;
        next();
    };
}

export default validateRequestMiddleware;
