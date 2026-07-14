import { type RequestHandler } from 'express';
import { deletePromptUseCase } from '@src/modules/prompt/services.js';
import { type DeletePromptRequest } from '@src/routes/prompts.schema.js';

const deletePromptHandler: RequestHandler = async (req, res) => {
    const { params } = req.parsedRequest as DeletePromptRequest;

    await deletePromptUseCase.invoke({ id: params.id });

    res.status(204).send();
};

export default deletePromptHandler;
