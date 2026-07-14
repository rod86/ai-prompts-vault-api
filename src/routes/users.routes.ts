import { Router } from 'express';
import createUserHandler from '@src/handlers/users/createUserHandler.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import { CreateUserSchema } from '@src/routes/users.schema.js';

export const usersRouter = Router();

usersRouter.post('/users', validateRequestMiddleware(CreateUserSchema), createUserHandler);
