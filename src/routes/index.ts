import { Router } from 'express';
import { promptsRouter } from '@src/routes/prompts.routes.js';

export const apiRouter = Router();

apiRouter.use(promptsRouter);
