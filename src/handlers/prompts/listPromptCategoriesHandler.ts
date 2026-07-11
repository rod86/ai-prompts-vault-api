import { type RequestHandler } from 'express';
import { listPromptCategoriesUseCase } from '@src/modules/prompt/services.js';

const listPromptCategoriesHandler: RequestHandler = async (_req, res) => {
    res.status(200).json(await listPromptCategoriesUseCase.invoke());
};

export default listPromptCategoriesHandler;
