import { type RequestHandler } from 'express';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { deletePromptUseCase } from '@src/modules/prompt/services.js';
import { type DeletePromptRequest } from '@src/routes/prompts/prompts.request.schema.js';

const deletePromptHandler: RequestHandler = async (req, res) => {
    const { params } = req.parsedRequest as DeletePromptRequest;

    if (!req.auth) {
        throw new MissingTokenError();
    }

    await deletePromptUseCase.invoke({ id: params.id, userId: req.auth.userId });

    res.status(204).send();
};

export default deletePromptHandler;
