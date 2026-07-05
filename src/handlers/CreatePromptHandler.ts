import { randomUUID } from 'node:crypto';
import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import { createPromptUseCase } from '@logic/prompt/services.js';
import CreatePromptSchema from '@src/schemas/CreatePromptSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { title, prompt, category_id: categoryId, description } = req.parsedRequest
        ?.body as z.infer<typeof CreatePromptSchema.body>;

    try {
        const now = new Date();
        const createdPrompt = await createPromptUseCase.invoke({
            id: randomUUID(),
            title,
            prompt,
            categoryId,
            description,
            createdAt: now,
            updatedAt: now,
        });
        res.status(201).json(createdPrompt);
    } catch (err) {
        if (err instanceof CategoryNotFoundError) {
            res.status(400).json({ error: err.message });
            return;
        }

        throw err;
    }
};
