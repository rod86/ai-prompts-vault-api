import { type RequestHandler } from 'express';
import { listPromptCategoriesUseCase } from '@src/modules/prompt/services.js';
import { type PromptCategoryListResponse } from '@src/routes/prompts/prompts.response.schema.js';

const listPromptCategoriesHandler: RequestHandler<
    Record<string, string>,
    PromptCategoryListResponse
> = async (_req, res) => {
    const categories = await listPromptCategoriesUseCase.invoke();

    res.status(200).json(categories.map((category) => ({ id: category.id, name: category.name })));
};

export default listPromptCategoriesHandler;
