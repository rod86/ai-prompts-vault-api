import express, { json, type Express, type Request, type Response } from 'express';

const app: Express = express();

app.use(json());

// Liveness/readiness probe. Replaced/extended as features land.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Feature routers are mounted here, e.g.:
// app.use('/prompts', createPromptRouter(deps));

export default app;
