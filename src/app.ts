import express, { json, type Request, type Response } from 'express';
import getCategoriesHandler from '@src/handlers/GetCategoriesHandler.js';
import getPromptHandler from '@src/handlers/GetPromptHandler.js';
import getPromptsHandler from '@src/handlers/GetPromptsHandler.js';
import { validateRequestMiddleware } from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import GetPromptSchema from '@src/schemas/GetPromptSchema.js';
import GetPromptsSchema from '@src/schemas/GetPromptsSchema.js';

const app = express();

app.use(json());

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/categories', getCategoriesHandler);
app.get('/prompts', validateRequestMiddleware(GetPromptsSchema), getPromptsHandler);
app.get('/prompts/:id', validateRequestMiddleware(GetPromptSchema), getPromptHandler);

export default app;
