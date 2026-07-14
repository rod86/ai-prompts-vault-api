import { Router } from 'express';
import createPromptHandler from '@src/handlers/prompts/createPromptHandler.js';
import deletePromptHandler from '@src/handlers/prompts/deletePromptHandler.js';
import listPromptCategoriesHandler from '@src/handlers/prompts/listPromptCategoriesHandler.js';
import updatePromptHandler from '@src/handlers/prompts/updatePromptHandler.js';
import requireAuthMiddleware from '@src/middleware/requireAuthMiddleware.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import {
    CreatePromptSchema,
    DeletePromptSchema,
    UpdatePromptSchema,
} from '@src/routes/prompts.schema.js';

export const promptsRouter = Router();

promptsRouter.get('/prompt-categories', listPromptCategoriesHandler);
promptsRouter.post(
    '/prompts',
    requireAuthMiddleware,
    validateRequestMiddleware(CreatePromptSchema),
    createPromptHandler,
);
promptsRouter.put(
    '/prompts/:id',
    validateRequestMiddleware(UpdatePromptSchema),
    updatePromptHandler,
);
promptsRouter.delete(
    '/prompts/:id',
    validateRequestMiddleware(DeletePromptSchema),
    deletePromptHandler,
);
