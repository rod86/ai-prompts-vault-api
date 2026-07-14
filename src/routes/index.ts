import { Router } from 'express';
import { promptsRouter } from '@src/routes/prompts.routes.js';
import { usersRouter } from '@src/routes/users.routes.js';

export const apiRouter = Router();

apiRouter.use(promptsRouter);
apiRouter.use(usersRouter);
