import { z } from 'zod';

export const GetPromptsQuerySchema = z.object({
    category: z.string().optional(),
});
