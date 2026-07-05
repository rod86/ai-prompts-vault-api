import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { listPromptsUseCase } from '@logic/prompt/services.js';
import GetPromptsSchema from '@src/schemas/GetPromptsSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { category } = req.parsedRequest?.query as z.infer<typeof GetPromptsSchema.query>;
    const prompts = await listPromptsUseCase.invoke({ categoryId: category });

    res.status(200).json(prompts);
};
