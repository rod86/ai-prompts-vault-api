import { z } from 'zod';
import { uuidField } from '@src/routes/shared/fields.schema.js';

export const CreatePromptSchema = z.object({
    body: z.object({
        title: z.string({ error: 'Missing required value' }),
        prompt: z.string({ error: 'Missing required value' }),
        category_id: uuidField(),
        description: z.string().optional(),
    }),
});

export type CreatePromptRequest = z.infer<typeof CreatePromptSchema>;

export const UpdatePromptSchema = z.object({
    params: z.object({
        id: uuidField(),
    }),
    body: z.object({
        title: z.string({ error: 'Missing required value' }),
        prompt: z.string({ error: 'Missing required value' }),
        category_id: uuidField(),
        description: z.string().optional(),
    }),
});

export type UpdatePromptRequest = z.infer<typeof UpdatePromptSchema>;

export const DeletePromptSchema = z.object({
    params: z.object({
        id: uuidField(),
    }),
});

export type DeletePromptRequest = z.infer<typeof DeletePromptSchema>;
