import path from 'node:path';
import express, { type Request, type Response } from 'express';
import config from '@src/config/config.js';
import { openApiDocument } from '@src/docs/api.js';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import notFoundMiddleware from '@src/middleware/notFoundMiddleware.js';
import createRateLimitMiddleware from '@src/middleware/rateLimit/createRateLimitMiddleware.js';
import { apiRouter } from '@src/routes/index.js';

const app = express();

app.set('trust proxy', config.trustProxyHops);

app.use(express.json());
app.use(createRateLimitMiddleware(config.rateLimit));

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/openapi.json', (_req: Request, res: Response) => {
    res.status(200).json(openApiDocument);
});

app.use(express.static(path.join(process.cwd(), 'public')));

app.use(apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
