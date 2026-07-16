import { type ZodOpenApiPathsObject } from 'zod-openapi';
import {
    ErrorResponseSchema,
    ValidationErrorResponseSchema,
} from '@src/routes/shared.response.schema.js';
import { UserResponseSchema } from '@src/routes/users.response.schema.js';
import { CreateUserSchema } from '@src/routes/users.schema.js';

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
                '400': {
                    description: 'Invalid input',
                    content: { 'application/json': { schema: ValidationErrorResponseSchema } },
                },
                '422': {
                    description: 'Email already in use',
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
