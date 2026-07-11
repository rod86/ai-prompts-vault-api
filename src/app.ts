import express, { type Request, type Response } from 'express';
import { apiRouter } from '@src/routes/index.js';

const app = express();

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.use(apiRouter);

export default app;
