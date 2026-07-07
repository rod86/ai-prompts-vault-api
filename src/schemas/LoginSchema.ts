import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    body: z.object({
        email: z.email({ error: 'Missing required value' }),
        password: z.string({ error: 'Missing required value' }),
    }),
} satisfies RequestSchema;
