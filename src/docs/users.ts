import { type ZodOpenApiPathsObject } from 'zod-openapi';
import { rateLimitedResponse, validationErrorResponse } from '@src/docs/global.js';
import { ErrorResponseSchema } from '@src/routes/shared/error.response.schema.js';
import { CreateUserSchema } from '@src/routes/users/users.request.schema.js';
import { UserResponseSchema } from '@src/routes/users/users.response.schema.js';

export const usersPaths: ZodOpenApiPathsObject = {
    '/users': {
        post: {
            tags: ['Users'],
            summary: 'Register a user',
            requestBody: {
                content: {
                    'application/json': { schema: CreateUserSchema.shape.body },
                },
            },
            responses: {
                '201': {
                    description: 'The user was registered',
                    content: { 'application/json': { schema: UserResponseSchema } },
                },
                '400': validationErrorResponse('Invalid input'),
                '422': {
                    description: 'Email already in use',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': rateLimitedResponse,
            },
        },
    },
};
