import { type RequestHandler } from 'express';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { createPromptUseCase } from '@src/modules/prompt/services.js';
import { type CreatePromptRequest } from '@src/routes/prompts/prompts.request.schema.js';
import { type PromptResponse } from '@src/routes/prompts/prompts.response.schema.js';

const createPromptHandler: RequestHandler<Record<string, string>, PromptResponse> = async (
    req,
    res,
) => {
    const { body } = req.parsedRequest as CreatePromptRequest;

    if (!req.auth) {
        throw new MissingTokenError();
    }

    const prompt = await createPromptUseCase.invoke({
        title: body.title,
        prompt: body.prompt,
        categoryId: body.category_id,
        userId: req.auth.userId,
        description: body.description,
    });

    res.status(201).json({
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

export default createPromptHandler;
