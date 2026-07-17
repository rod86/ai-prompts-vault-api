import { type RequestHandler } from 'express';
import { type HealthResponse } from '@src/routes/health/health.response.schema.js';

const healthHandler: RequestHandler<Record<string, string>, HealthResponse> = (_req, res) => {
    res.status(200).json({ status: 'ok' });
};

export default healthHandler;
