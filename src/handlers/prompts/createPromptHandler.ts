import { type RequestHandler } from 'express';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { createPromptUseCase } from '@src/modules/prompt/services.js';
import { type CreatePromptRequest } from '@src/routes/prompts.schema.js';

const createPromptHandler: RequestHandler = async (req, res) => {
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
        created_at: prompt.createdAt,
        updated_at: prompt.updatedAt,
    });
};

export default createPromptHandler;
