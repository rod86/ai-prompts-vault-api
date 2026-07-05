import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { listPromptsUseCase } from '@logic/prompt/services.js';
import { type GetPromptsQuerySchema } from '@src/handlers/schemas/GetPromptsQuerySchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { category } = req.parsedRequest?.query as z.infer<typeof GetPromptsQuerySchema>;
    const prompts = await listPromptsUseCase.invoke({ categoryId: category });

    res.status(200).json(prompts);
};
