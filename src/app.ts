import express, { json, type Express, type Request, type Response } from 'express';

/**
 * Builds and configures the Express application: middleware and route wiring.
 *
 * The app is intentionally created without calling `listen` so it can be
 * imported directly by Supertest for integration tests. Server startup lives
 * in `index.ts`.
 *
 * Bounded-context routers (from `src/logic/<context>/infrastructure`) are
 * mounted here as they are implemented.
 */
export function createApp(): Express {
  const app = express();

  app.use(json());

  // Liveness/readiness probe. Replaced/extended as features land.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Feature routers are mounted here, e.g.:
  // app.use('/prompts', createPromptRouter(deps));

  return app;
}
