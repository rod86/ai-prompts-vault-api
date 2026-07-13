import { z } from 'zod';

export const CreatePromptSchema = z.object({
    body: z.object({
        title: z.string(),
        prompt: z.string(),
        category_id: z.string().uuid(),
        description: z.string().optional(),
    }),
});

export type CreatePromptRequest = z.infer<typeof CreatePromptSchema>;
