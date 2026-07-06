import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    params: z.object({
        id: z.uuid({
            error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value'),
        }),
    }),
    body: z.object({
        title: z.string({ error: 'Missing required value' }).min(1),
        prompt: z.string({ error: 'Missing required value' }).min(1),
        category_id: z.uuid({
            error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value'),
        }),
        description: z.string().nullable(),
    }),
} satisfies RequestSchema;
