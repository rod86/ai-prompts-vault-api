import express, { json, type Request, type Response } from 'express';
import getCategoriesHandler from '@src/handlers/GetCategoriesHandler.js';
import getPromptHandler from '@src/handlers/GetPromptHandler.js';
import getPromptsHandler from '@src/handlers/GetPromptsHandler.js';

const app = express();

app.use(json());

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/categories', getCategoriesHandler);
app.get('/prompts', getPromptsHandler);
app.get('/prompts/:id', getPromptHandler);

export default app;
