import { type ZodOpenApiPathsObject } from 'zod-openapi';
import { ErrorResponseSchema, HealthResponseSchema } from '@src/routes/shared.response.schema.js';

export const healthPaths: ZodOpenApiPathsObject = {
    '/health': {
        get: {
            tags: ['Health'],
            summary: 'Check service health',
            responses: {
                '200': {
                    description: 'The service is healthy',
                    content: { 'application/json': { schema: HealthResponseSchema } },
                },
                '429': {
                    description: 'Request allowance exceeded',
                    content: { 'application/json': { schema: ErrorResponseSchema } },
                },
            },
        },
    },
};
