import express, { json, type Request, type Response } from 'express';
import getCategoriesHandler from '@src/handlers/GetCategories.js';

const app = express();

app.use(json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/categories', getCategoriesHandler);

export default app;
