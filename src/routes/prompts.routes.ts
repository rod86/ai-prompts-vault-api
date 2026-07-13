import { Router } from 'express';
import createPromptHandler from '@src/handlers/prompts/createPromptHandler.js';
import listPromptCategoriesHandler from '@src/handlers/prompts/listPromptCategoriesHandler.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import { CreatePromptSchema } from '@src/routes/prompts.schema.js';

export const promptsRouter = Router();

promptsRouter.get('/prompt-categories', listPromptCategoriesHandler);
promptsRouter.post('/prompts', validateRequestMiddleware(CreatePromptSchema), createPromptHandler);
