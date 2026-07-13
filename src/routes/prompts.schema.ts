import { z } from 'zod';

export const CreatePromptSchema = z.object({
    body: z.object({
        title: z.string({ error: 'Missing required value' }),
        prompt: z.string({ error: 'Missing required value' }),
        category_id: z.uuid({
            error: (issue) =>
                issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value',
        }),
        description: z.string().optional(),
    }),
});

export type CreatePromptRequest = z.infer<typeof CreatePromptSchema>;
