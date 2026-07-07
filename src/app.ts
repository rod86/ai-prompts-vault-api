import express, { json, type Request, type Response } from 'express';
import createPromptHandler from '@src/handlers/CreatePromptHandler.js';
import deletePromptHandler from '@src/handlers/DeletePromptHandler.js';
import getCategoriesHandler from '@src/handlers/GetCategoriesHandler.js';
import getPromptHandler from '@src/handlers/GetPromptHandler.js';
import getPromptsHandler from '@src/handlers/GetPromptsHandler.js';
import loginHandler from '@src/handlers/LoginHandler.js';
import registerUserHandler from '@src/handlers/RegisterUserHandler.js';
import updatePromptHandler from '@src/handlers/UpdatePromptHandler.js';
import { validateRequestMiddleware } from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import CreatePromptSchema from '@src/schemas/CreatePromptSchema.js';
import DeletePromptSchema from '@src/schemas/DeletePromptSchema.js';
import GetPromptSchema from '@src/schemas/GetPromptSchema.js';
import GetPromptsSchema from '@src/schemas/GetPromptsSchema.js';
import LoginSchema from '@src/schemas/LoginSchema.js';
import RegisterUserSchema from '@src/schemas/RegisterUserSchema.js';
import UpdatePromptSchema from '@src/schemas/UpdatePromptSchema.js';

const app = express();

app.use(json());

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/categories', getCategoriesHandler);
app.get('/prompts', validateRequestMiddleware(GetPromptsSchema), getPromptsHandler);
app.get('/prompts/:id', validateRequestMiddleware(GetPromptSchema), getPromptHandler);
app.post('/prompts', validateRequestMiddleware(CreatePromptSchema), createPromptHandler);
app.put('/prompts/:id', validateRequestMiddleware(UpdatePromptSchema), updatePromptHandler);
app.delete('/prompts/:id', validateRequestMiddleware(DeletePromptSchema), deletePromptHandler);
app.post('/users', validateRequestMiddleware(RegisterUserSchema), registerUserHandler);
app.post('/authenticate', validateRequestMiddleware(LoginSchema), loginHandler);

export default app;
