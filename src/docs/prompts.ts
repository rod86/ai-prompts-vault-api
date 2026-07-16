import { type ZodOpenApiPathsObject } from 'zod-openapi';
import {
    PromptCategoryListResponseSchema,
    PromptResponseSchema,
} from '@src/routes/prompts.response.schema.js';
import {
    CreatePromptSchema,
    DeletePromptSchema,
    UpdatePromptSchema,
} from '@src/routes/prompts.schema.js';
import {
    ErrorResponseSchema,
    ValidationErrorResponseSchema,
} from '@src/routes/shared.response.schema.js';

export const promptsPaths: ZodOpenApiPathsObject = {
    '/prompt-categories': {
        get: {
            tags: ['Prompts'],
            summary: 'List prompt categories',
            responses: {
                '200': {
                    description: 'The list of prompt categories',
                    content: { 'application/json': { schema: PromptCategoryListResponseSchema } },
                },
                '429': {
                    description: 'Request allowance exceeded',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
            },
        },
    },
    '/prompts': {
        post: {
            tags: ['Prompts'],
            summary: 'Create a prompt',
            security: [{ bearerAuth: [] }],
            requestBody: {
                content: {
                    'application/json': { schema: CreatePromptSchema.shape.body },
                },
            },
            responses: {
                '201': {
                    description: 'The prompt was created',
                    content: { 'application/json': { schema: PromptResponseSchema } },
                },
                '400': {
                    description: 'Invalid input',
                    content: { 'application/json': { schema: ValidationErrorResponseSchema } },
                },
                '401': {
                    description: 'Missing or invalid authentication token',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '422': {
                    description: 'Unknown category or user',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': {
                    description: 'Request allowance exceeded',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
            },
        },
    },
    '/prompts/{id}': {
        put: {
            tags: ['Prompts'],
            summary: 'Update a prompt',
            security: [{ bearerAuth: [] }],
            requestParams: { path: UpdatePromptSchema.shape.params },
            requestBody: {
                content: {
                    'application/json': { schema: UpdatePromptSchema.shape.body },
                },
            },
            responses: {
                '200': {
                    description: 'The prompt was updated',
                    content: { 'application/json': { schema: PromptResponseSchema } },
                },
                '400': {
                    description: 'Invalid input',
                    content: { 'application/json': { schema: ValidationErrorResponseSchema } },
                },
                '401': {
                    description: 'Missing or invalid authentication token',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '403': {
                    description: 'Not the owner of this prompt',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '404': {
                    description: 'Prompt not found',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '422': {
                    description: 'Unknown category',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': {
                    description: 'Request allowance exceeded',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
            },
        },
        delete: {
            tags: ['Prompts'],
            summary: 'Delete a prompt',
            security: [{ bearerAuth: [] }],
            requestParams: { path: DeletePromptSchema.shape.params },
            responses: {
                '204': {
                    description: 'The prompt was deleted',
                },
                '400': {
                    description: 'Invalid input',
                    content: { 'application/json': { schema: ValidationErrorResponseSchema } },
                },
                '401': {
                    description: 'Missing or invalid authentication token',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '403': {
                    description: 'Not the owner of this prompt',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '404': {
                    description: 'Prompt not found',
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
