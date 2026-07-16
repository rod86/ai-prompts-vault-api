import { z } from 'zod';

export const PromptResponseSchema = z
    .object({
        id: z.string(),
        title: z.string(),
        prompt: z.string(),
        description: z.string().nullable(),
        category: z.object({ id: z.string(), name: z.string() }),
        user: z.object({ id: z.string(), name: z.string() }),
        created_at: z.iso.datetime(),
        updated_at: z.iso.datetime(),
    })
    .meta({ id: 'Prompt' });

export type PromptResponse = z.infer<typeof PromptResponseSchema>;

const PromptCategorySchema = z
    .object({
        id: z.string(),
        name: z.string(),
    })
    .meta({ id: 'PromptCategory' });

export const PromptCategoryListResponseSchema = z.array(PromptCategorySchema);

export type PromptCategoryListResponse = z.infer<typeof PromptCategoryListResponseSchema>;
