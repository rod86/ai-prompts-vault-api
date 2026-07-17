import { Router } from 'express';
import { authRouter } from '@src/routes/auth/auth.routes.js';
import { healthRouter } from '@src/routes/health/health.routes.js';
import { promptsRouter } from '@src/routes/prompts/prompts.routes.js';
import { usersRouter } from '@src/routes/users/users.routes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(promptsRouter);
apiRouter.use(usersRouter);
