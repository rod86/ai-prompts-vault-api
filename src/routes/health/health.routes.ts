import { Router } from 'express';
import healthHandler from '@src/handlers/health/healthHandler.js';

export const healthRouter = Router();

healthRouter.get('/health', healthHandler);
