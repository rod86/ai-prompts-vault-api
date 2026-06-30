import express, { json, type Express, type Request, type Response } from 'express';

const app = express();

app.use(json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
