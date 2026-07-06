import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    body: z.object({
        title: z.string().min(1),
        prompt: z.string().min(1),
        category_id: z.uuid(),
        description: z.string().optional(),
    }),
} satisfies RequestSchema;
