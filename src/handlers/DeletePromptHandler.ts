import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import { deletePromptUseCase } from '@logic/prompt/services.js';
import DeletePromptSchema from '@src/schemas/DeletePromptSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { id } = req.parsedRequest?.params as z.infer<typeof DeletePromptSchema.params>;

    try {
        await deletePromptUseCase.invoke({ id });
        res.status(204).send();
    } catch (err) {
        if (err instanceof PromptNotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }

        throw err;
    }
};
