import { Router } from 'express';
import { authRouter } from '@src/routes/auth/auth.routes.js';
import { promptsRouter } from '@src/routes/prompts.routes.js';
import { usersRouter } from '@src/routes/users.routes.js';

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(promptsRouter);
apiRouter.use(usersRouter);
