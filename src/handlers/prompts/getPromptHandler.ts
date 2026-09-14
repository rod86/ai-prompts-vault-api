import { type RequestHandler } from 'express';
import { getPromptUseCase } from '@src/modules/prompt/services.js';
import { type GetPromptRequest } from '@src/routes/prompts/prompts.request.schema.js';
import { type PromptResponse } from '@src/routes/prompts/prompts.response.schema.js';

const getPromptHandler: RequestHandler<Record<string, string>, PromptResponse> = async (
    req,
    res,
) => {
    const { params } = req.parsedRequest as GetPromptRequest;

    const prompt = await getPromptUseCase.invoke({ id: params.id });

    res.status(200).json({
        id: prompt.id,
        title: prompt.title,
        prompt: prompt.prompt,
        description: prompt.description || null,
        category: prompt.category,
        user: prompt.user,
        created_at: prompt.createdAt.toISOString(),
        updated_at: prompt.updatedAt.toISOString(),
    });
};

export default getPromptHandler;
