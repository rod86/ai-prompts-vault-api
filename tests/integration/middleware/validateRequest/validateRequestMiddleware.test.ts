import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';

describe('validateRequestMiddleware', () => {
    it('exposes the normalized, declared-only parts to the handler on a valid request', async () => {
        const schema = z.object({
            query: z.object({ page: z.coerce.number() }),
            body: z.object({ name: z.string().min(1) }),
        });
        const app = express();
        app.use(express.json());
        app.post('/prompts', validateRequestMiddleware(schema), (req: Request, res: Response) => {
            res.status(200).json(req.parsedRequest);
        });

        const response = await request(app)
            .post('/prompts?page=2')
            .send({ name: 'prompt', extra: 'stripped' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ query: { page: 2 }, body: { name: 'prompt' } });
    });
});
