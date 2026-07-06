import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import { updatePromptUseCase } from '@logic/prompt/services.js';
import UpdatePromptSchema from '@src/schemas/UpdatePromptSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { id } = req.parsedRequest?.params as z.infer<typeof UpdatePromptSchema.params>;
    const { title, prompt, category_id: categoryId, description } = req.parsedRequest
        ?.body as z.infer<typeof UpdatePromptSchema.body>;

    try {
        const updatedPrompt = await updatePromptUseCase.invoke({
            id,
            title,
            prompt,
            categoryId,
            description: description ?? undefined,
            updatedAt: new Date(),
        });
        res.status(200).json(updatedPrompt);
    } catch (err) {
        if (err instanceof PromptNotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }

        if (err instanceof CategoryNotFoundError) {
            res.status(400).json({ error: err.message });
            return;
        }

        throw err;
    }
};
