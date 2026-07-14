import { Router } from 'express';
import authenticateHandler from '@src/handlers/auth/authenticateHandler.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import { AuthenticateSchema } from '@src/routes/auth.schema.js';

export const authRouter = Router();

authRouter.post(
    '/authenticate',
    validateRequestMiddleware(AuthenticateSchema),
    authenticateHandler,
);
