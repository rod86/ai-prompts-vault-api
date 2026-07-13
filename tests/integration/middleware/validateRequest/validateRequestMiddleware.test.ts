import express from 'express';
import request from 'supertest';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import validateRequestMiddleware from '@src/middleware/validateRequest/validateRequestMiddleware.js';

describe('validateRequestMiddleware', () => {
    it('exposes the normalized, declared-only parts on req.parsedRequest for a valid request', async () => {
        const schema = v.object({
            params: v.object({ id: v.string() }),
            body: v.object({ name: v.string() }),
        });
        const app = express();
        app.use(express.json());
        app.post('/items/:id', validateRequestMiddleware(schema), (req, res) => {
            res.status(200).json(req.parsedRequest);
        });

        const response = await request(app)
            .post('/items/abc-123')
            .query({ page: '2' })
            .send({ name: 'a prompt' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            params: { id: 'abc-123' },
            body: { name: 'a prompt' },
        });
    });
});
