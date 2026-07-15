import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';

describe('errorMiddleware', () => {
    it('renders the RequestValidationError contract and never reaches the handler', async () => {
        const schema = z.object({
            body: z.object({ name: z.string().min(1, 'name invalid') }),
        });
        const app = express();
        app.use(express.json());
        let handlerReached = false;
        app.post('/prompts', validateRequestMiddleware(schema), (_req: Request, res: Response) => {
            handlerReached = true;
            res.status(200).json({ status: 'ok' });
        });
        app.use(errorMiddleware);

        const response = await request(app).post('/prompts').send({ name: '' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Request Validation data failed',
            details: { body: { name: 'name invalid' } },
        });
        expect(handlerReached).toBe(false);
    });

    it('renders a generic internal error for a non-validation failure', async () => {
        const app = express();
        app.get('/boom', () => {
            throw new Error('unexpected');
        });
        app.use(errorMiddleware);

        const response = await request(app).get('/boom');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: 'InternalServerError',
            message: 'Internal server error',
        });
    });
});
