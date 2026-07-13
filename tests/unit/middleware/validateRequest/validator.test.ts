import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import validator from '@src/middleware/validateRequest/validator.js';

describe('validator', () => {
    it('returns a success result with the normalized, declared-only parts', () => {
        const schema = z.object({
            params: z.object({ id: z.string().uuid() }),
            query: z.object({ page: z.coerce.number() }),
            body: z.object({ name: z.string().min(1) }),
        });
        const id = '03655fd9-3303-4206-af5a-1a2405740183';
        const input = { params: { id }, query: { page: '2' }, body: { name: 'prompt' } };

        const result = validator(schema, input);

        expect(result).toEqual({
            success: true,
            data: { params: { id }, query: { page: 2 }, body: { name: 'prompt' } },
        });
    });

    it('omits an undeclared part from data even when the input supplies it', () => {
        const schema = z.object({
            params: z.object({ id: z.string().uuid() }),
            body: z.object({ name: z.string().min(1) }),
        });
        const id = '03655fd9-3303-4206-af5a-1a2405740183';
        const input = {
            params: { id },
            query: { page: '2' },
            body: { name: 'prompt' },
        };

        const result = validator(schema, input);

        expect(result.success).toBe(true);
        expect(result.success && 'query' in result.data).toBe(false);
    });

    it('returns a grouped-errors failure result without throwing', () => {
        const schema = z.object({
            body: z.object({ name: z.string().min(1, 'name invalid') }),
            query: z.object({ page: z.coerce.number().min(1, 'page invalid') }),
        });
        const input = { body: { name: '' }, query: { page: '0' } };

        const result = validator(schema, input);

        expect(result).toEqual({
            success: false,
            errors: { body: { name: 'name invalid' }, query: { page: 'page invalid' } },
        });
    });
});
