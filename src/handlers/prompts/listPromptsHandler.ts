import { type RequestHandler } from 'express';
import { listPromptsUseCase } from '@src/modules/prompt/services.js';
import { type ListPromptsRequest } from '@src/routes/prompts/prompts.request.schema.js';
import { type PromptListResponse } from '@src/routes/prompts/prompts.response.schema.js';

const listPromptsHandler: RequestHandler<Record<string, string>, PromptListResponse> = async (
    req,
    res,
) => {
    const { query } = req.parsedRequest as ListPromptsRequest;

    const prompts = await listPromptsUseCase.invoke({ categoryId: query.category_id });

    res.status(200).json(
        prompts.map((prompt) => ({
            id: prompt.id,
            title: prompt.title,
            prompt: prompt.prompt,
            description: prompt.description || null,
            category: prompt.category,
            user: prompt.user,
            created_at: prompt.createdAt.toISOString(),
            updated_at: prompt.updatedAt.toISOString(),
        })),
    );
};

export default listPromptsHandler;
