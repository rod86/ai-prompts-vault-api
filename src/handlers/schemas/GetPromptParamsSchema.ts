import { z } from 'zod';

export const GetPromptParamsSchema = z.object({
    id: z.string(),
});
