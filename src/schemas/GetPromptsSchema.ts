import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    query: z.object({ category: z.string().optional() }),
} satisfies RequestSchema;
