import {
    ErrorResponseSchema,
    ValidationErrorResponseSchema,
} from '@src/routes/shared/error.response.schema.js';

export const unauthorizedResponse = {
    description: 'Missing or invalid authentication token',
    content: { 'application/json': { schema: ErrorResponseSchema } },
};

export const rateLimitedResponse = {
    description: 'Request allowance exceeded',
    content: { 'application/json': { schema: ErrorResponseSchema } },
};

export const validationErrorResponse = (
    description: string,
): {
    description: string;
    content: { 'application/json': { schema: typeof ValidationErrorResponseSchema } };
} => ({
    description,
    content: { 'application/json': { schema: ValidationErrorResponseSchema } },
});
