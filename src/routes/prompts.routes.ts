import { Router } from 'express';
import { listPromptCategoriesHandler } from '@src/handlers/prompts/listPromptCategoriesHandler.js';

export const promptsRouter = Router();

promptsRouter.get('/prompt-categories', listPromptCategoriesHandler);
