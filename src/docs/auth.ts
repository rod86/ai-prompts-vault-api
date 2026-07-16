import { type ZodOpenApiPathsObject } from 'zod-openapi';
import { AuthenticateResponseSchema } from '@src/routes/auth.response.schema.js';
import { AuthenticateSchema } from '@src/routes/auth.schema.js';
import {
    ErrorResponseSchema,
    ValidationErrorResponseSchema,
} from '@src/routes/shared.response.schema.js';

export const authPaths: ZodOpenApiPathsObject = {
    '/authenticate': {
        post: {
            tags: ['Authentication'],
            summary: 'Authenticate with email and password',
            requestBody: {
                content: {
                    'application/json': { schema: AuthenticateSchema.shape.body },
                },
            },
            responses: {
                '200': {
                    description: 'Authentication succeeded',
                    content: { 'application/json': { schema: AuthenticateResponseSchema } },
                },
                '400': {
                    description: 'Invalid input',
                    content: { 'application/json': { schema: ValidationErrorResponseSchema } },
                },
                '401': {
                    description: 'Invalid authentication credentials',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': {
                    description: 'Request allowance exceeded',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
            },
        },
    },
};
