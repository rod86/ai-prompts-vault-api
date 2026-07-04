import { type Request, type Response } from 'express';
import { listPromptCategoriesUseCase } from '@logic/prompt/services.js';

export default async (_req: Request, res: Response): Promise<void> => {
    const categories = await listPromptCategoriesUseCase.invoke();

    res.status(200).json(categories);
};
