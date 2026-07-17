import { z } from 'zod';

export const ErrorResponseSchema = z
    .object({
        status: z.number(),
        code: z.string(),
        message: z.string(),
    })
    .meta({ id: 'Error' });

export const ValidationErrorResponseSchema = ErrorResponseSchema.extend({
    details: z.object({
        params: z.record(z.string(), z.string()).optional(),
        query: z.record(z.string(), z.string()).optional(),
        body: z.record(z.string(), z.string()).optional(),
    }),
}).meta({ id: 'ValidationError' });
