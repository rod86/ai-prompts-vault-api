import { type ZodOpenApiPathsObject } from 'zod-openapi';
import {
    rateLimitedResponse,
    unauthorizedResponse,
    validationErrorResponse,
} from '@src/docs/global.js';
import {
    CreatePromptSchema,
    DeletePromptSchema,
    UpdatePromptSchema,
} from '@src/routes/prompts/prompts.request.schema.js';
import {
    PromptCategoryListResponseSchema,
    PromptResponseSchema,
} from '@src/routes/prompts/prompts.response.schema.js';
import { ErrorResponseSchema } from '@src/routes/shared/error.response.schema.js';

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
                '429': rateLimitedResponse,
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
                '400': validationErrorResponse('Invalid input'),
                '401': unauthorizedResponse,
                '422': {
                    description: 'Unknown category or user',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': rateLimitedResponse,
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
                '400': validationErrorResponse('Invalid input'),
                '401': unauthorizedResponse,
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
                '429': rateLimitedResponse,
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
                '400': validationErrorResponse('Invalid input'),
                '401': unauthorizedResponse,
                '403': {
                    description: 'Not the owner of this prompt',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '404': {
                    description: 'Prompt not found',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
                '429': rateLimitedResponse,
            },
        },
    },
};
