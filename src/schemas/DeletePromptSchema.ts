import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    params: z.object({
        id: z.uuid({
            error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value'),
        }),
    }),
} satisfies RequestSchema;
