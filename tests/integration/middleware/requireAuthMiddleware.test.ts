import jwt from 'jsonwebtoken';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import config from '@src/config/config.js';
import errorMiddleware from '@src/middleware/errorMiddleware.js';
import requireAuthMiddleware from '@src/middleware/requireAuthMiddleware.js';

describe('requireAuthMiddleware', () => {
    function buildApp() {
        const app = express();
        app.get('/protected', requireAuthMiddleware, (req: Request, res: Response) => {
            res.status(200).json(req.auth);
        });
        app.use(errorMiddleware);
        return app;
    }

    it('attaches the caller identity for a valid, unexpired token', async () => {
        const token = jwt.sign(
            { sub: 'fixture-user-id', exp: Math.floor(Date.now() / 1000) + 3600 },
            config.jwtSecret,
            { algorithm: 'HS256' },
        );
        const app = buildApp();

        const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ userId: 'fixture-user-id' });
    });

    it('rejects a request with no Authorization header', async () => {
        const app = buildApp();

        const response = await request(app).get('/protected');

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ error: 'MissingTokenError' });
    });
});
