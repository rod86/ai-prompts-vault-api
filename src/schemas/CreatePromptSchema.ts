import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

const requiredString = (): z.ZodString =>
    z.string({ error: (issue) => (issue.input === undefined ? 'Missing required value' : undefined) });

export default {
    body: z.object({
        title: requiredString().min(1),
        prompt: requiredString().min(1),
        category_id: z.uuid({
            error: (issue) => (issue.input === undefined ? 'Missing required value' : 'Invalid UUID value'),
        }),
        description: z.string().optional(),
    }),
} satisfies RequestSchema;
