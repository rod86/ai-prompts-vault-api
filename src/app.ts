import express, { type Request, type Response } from 'express';
import notFoundMiddleware from '@src/middleware/notFoundMiddleware.js';
import { apiRouter } from '@src/routes/index.js';

const app = express();

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.use(apiRouter);
app.use(notFoundMiddleware);

export default app;
