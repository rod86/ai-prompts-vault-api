import { type Request, type Response } from 'express';
import { listPromptsUseCase } from '@logic/prompt/services.js';
import { GetPromptsQuerySchema } from '@src/handlers/schemas/GetPromptsQuerySchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { category } = GetPromptsQuerySchema.parse(req.query);
    const prompts = await listPromptsUseCase.invoke({ categoryId: category });

    res.status(200).json(prompts);
};
