import express, { type Request, type Response } from 'express';
import config from '@src/config/config.js';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import notFoundMiddleware from '@src/middleware/notFoundMiddleware.js';
import createRateLimitMiddleware from '@src/middleware/rateLimit/createRateLimitMiddleware.js';
import { apiRouter } from '@src/routes/index.js';

const app = express();

app.use(express.json());
app.use(createRateLimitMiddleware(config.rateLimit));

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.use(apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
