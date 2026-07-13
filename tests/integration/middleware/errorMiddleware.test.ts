import express from 'express';
import request from 'supertest';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';

describe('errorMiddleware', () => {
    it('renders the RequestValidationError contract for an invalid request and never reaches the handler', async () => {
        const schema = v.object({
            body: v.object({ name: v.string('name invalid') }),
        });
        const handler = vi.fn((req, res) => res.status(200).json(req.parsedRequest));
        const app = express();
        app.use(express.json());
        app.post('/items', validateRequestMiddleware(schema), handler);
        app.use(errorMiddleware);

        const response = await request(app).post('/items').send({ name: 123 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'RequestValidationError',
            message: 'Request Validation data failed',
            details: { body: { name: 'name invalid' } },
        });
        expect(handler).not.toHaveBeenCalled();
    });
});
