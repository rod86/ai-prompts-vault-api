import { type RequestHandler } from 'express';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { updatePromptUseCase } from '@src/modules/prompt/services.js';
import { type PromptResponse } from '@src/routes/prompts.response.schema.js';
import { type UpdatePromptRequest } from '@src/routes/prompts.schema.js';

const updatePromptHandler: RequestHandler<Record<string, string>, PromptResponse> = async (
    req,
    res,
) => {
    const { params, body } = req.parsedRequest as UpdatePromptRequest;

    if (!req.auth) {
        throw new MissingTokenError();
    }

    const prompt = await updatePromptUseCase.invoke({
        id: params.id,
        userId: req.auth.userId,
        title: body.title,
        prompt: body.prompt,
        categoryId: body.category_id,
        description: body.description,
    });

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

export default updatePromptHandler;
