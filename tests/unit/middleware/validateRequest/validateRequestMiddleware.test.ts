import { type NextFunction, type Request, type Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateRequestMiddleware } from '@src/middleware/validateRequest/validateRequestMiddleware.js';

describe('validateRequestMiddleware', () => {
    it('calls next() and exposes parsed data via req.parsedRequest when every part is valid', () => {
        const req = { params: { id: 'abc' }, query: {} } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        validateRequestMiddleware({ params: z.object({ id: z.string() }) })(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.parsedRequest).toEqual({ params: { id: 'abc' } });
    });

    it('responds 400 with combined errors directly, without calling next(), when any part is invalid', () => {
        const req = { params: {}, query: {} } as unknown as Request;
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as unknown as Response;
        const next = vi.fn() as NextFunction;
        const schema = {
            params: z.object({ id: z.string() }),
            query: z.object({ category: z.string() }),
        };

        validateRequestMiddleware(schema)(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'The request was invalid.',
            errors: expect.arrayContaining([
                expect.objectContaining({ field: 'params.id' }),
                expect.objectContaining({ field: 'query.category' }),
            ]),
        });
        expect(next).not.toHaveBeenCalled();
    });
});
