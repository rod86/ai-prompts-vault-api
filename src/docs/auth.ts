import { type ZodOpenApiPathsObject } from 'zod-openapi';
import { rateLimitedResponse, validationErrorResponse } from '@src/docs/global.js';
import { AuthenticateSchema } from '@src/routes/auth/auth.request.schema.js';
import { AuthenticateResponseSchema } from '@src/routes/auth/auth.response.schema.js';
import { ErrorResponseSchema } from '@src/routes/shared/error.response.schema.js';

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
                '400': validationErrorResponse('Invalid input'),
                '401': {
                    description: 'Invalid authentication credentials',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': rateLimitedResponse,
            },
        },
    },
};
