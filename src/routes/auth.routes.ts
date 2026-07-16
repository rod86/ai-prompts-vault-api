import { Router } from 'express';
import config from '@src/config/config.js';
import authenticateHandler from '@src/handlers/auth/authenticateHandler.js';
import createRateLimitMiddleware from '@src/middleware/rateLimit/createRateLimitMiddleware.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import { AuthenticateSchema } from '@src/routes/auth.schema.js';

export const authRouter = Router();

authRouter.post(
    '/authenticate',
    createRateLimitMiddleware(config.loginRateLimit),
    validateRequestMiddleware(AuthenticateSchema),
    authenticateHandler,
);
