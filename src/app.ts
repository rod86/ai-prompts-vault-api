import express, { json, type Request, type Response } from 'express';
import getCategoriesHandler from '@src/handlers/GetCategoriesHandler.js';
import getPromptHandler from '@src/handlers/GetPromptHandler.js';
import getPromptsHandler from '@src/handlers/GetPromptsHandler.js';
import { GetPromptParamsSchema } from '@src/handlers/schemas/GetPromptParamsSchema.js';
import { GetPromptsQuerySchema } from '@src/handlers/schemas/GetPromptsQuerySchema.js';
import { validateRequestMiddleware } from '@src/middleware/validateRequest/validateRequestMiddleware.js';

const app = express();

app.use(json());

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/categories', getCategoriesHandler);
app.get('/prompts', validateRequestMiddleware({ query: GetPromptsQuerySchema }), getPromptsHandler);
app.get(
    '/prompts/:id',
    validateRequestMiddleware({ params: GetPromptParamsSchema }),
    getPromptHandler,
);

export default app;
