import { type RequestHandler } from 'express';
import { createPromptUseCase } from '@src/modules/prompt/services.js';
import { type CreatePromptRequest } from '@src/routes/prompts.schema.js';

const createPromptHandler: RequestHandler = async (req, res) => {
    const { body } = req.parsedRequest as CreatePromptRequest;

    const prompt = await createPromptUseCase.invoke({
        title: body.title,
        prompt: body.prompt,
        categoryId: body.category_id,
        description: body.description,
    });

    res.status(201).json({
        id: prompt.id,
        title: prompt.title,
        prompt: prompt.prompt,
        description: prompt.description || null,
        category: prompt.category,
        created_at: prompt.createdAt,
        updated_at: prompt.updatedAt,
    });
};

export default createPromptHandler;
