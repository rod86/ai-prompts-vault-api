import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';
import { DomainError, type ErrorCategory } from '@src/modules/shared/domain/DomainError.js';

class StubDomainError extends DomainError {
    readonly code = 'STUB';
    readonly category: ErrorCategory = 'Unprocessable';
}

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

    it('renders a generic internal error for a non-validation failure and logs the cause', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const fixtureError = new Error('unexpected');
        const app = express();
        app.get('/boom', () => {
            throw fixtureError;
        });
        app.use(errorMiddleware);

        const response = await request(app).get('/boom');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            status: 500,
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(fixtureError);
    });

    it('renders a DomainError through the category status map', async () => {
        const app = express();
        app.get('/stub', () => {
            throw new StubDomainError('stub failed');
        });
        app.use(errorMiddleware);

        const response = await request(app).get('/stub');

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            status: 422,
            code: 'STUB',
            message: 'stub failed',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
});
