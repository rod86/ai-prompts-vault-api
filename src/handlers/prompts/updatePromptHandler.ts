import { type RequestHandler } from 'express';
import { updatePromptUseCase } from '@src/modules/prompt/services.js';
import { type UpdatePromptRequest } from '@src/routes/prompts.schema.js';

const updatePromptHandler: RequestHandler = async (req, res) => {
    const { params, body } = req.parsedRequest as UpdatePromptRequest;

    const prompt = await updatePromptUseCase.invoke({
        id: params.id,
        title: body.title,
        prompt: body.prompt,
        categoryId: body.category_id,
        description: body.description,
    });

    res.status(200).json({
        id: prompt.id,
        title: prompt.title,
        prompt: prompt.prompt,
        ...(prompt.description !== undefined && { description: prompt.description }),
        category: prompt.category,
        created_at: prompt.createdAt,
        updated_at: prompt.updatedAt,
    });
};

export default updatePromptHandler;
