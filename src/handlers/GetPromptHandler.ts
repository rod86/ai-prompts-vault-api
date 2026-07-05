import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import { getPromptUseCase } from '@logic/prompt/services.js';
import { type GetPromptParamsSchema } from '@src/handlers/schemas/GetPromptParamsSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { id } = req.parsedRequest?.params as z.infer<typeof GetPromptParamsSchema>;

    try {
        const prompt = await getPromptUseCase.invoke({ id });
        res.status(200).json(prompt);
    } catch (err) {
        if (err instanceof PromptNotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }

        throw err;
    }
};
