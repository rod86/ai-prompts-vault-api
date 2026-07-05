import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '@src/middleware/validateRequest/validation.js';

describe('validate', () => {
    it('returns parsed data for every provided part when all are valid', () => {
        const schema = {
            params: z.object({ id: z.string() }),
            query: z.object({ category: z.string().optional() }),
        };
        const data = { params: { id: 'abc' }, query: {} };

        const result = validate(data, schema);

        expect(result).toEqual({ valid: true, data: { params: { id: 'abc' }, query: {} } });
    });

    it('combines errors from every invalid part, each prefixed by its part name', () => {
        const schema = {
            params: z.object({ id: z.string() }),
            query: z.object({ category: z.string() }),
        };
        const data = { params: {}, query: {} };

        const result = validate(data, schema);

        expect(result.valid).toBe(false);
        if (result.valid) {
            throw new Error('expected result to be invalid');
        }
        expect(result.errors).toHaveLength(2);
        expect(result.errors).toContainEqual(expect.objectContaining({ field: 'params.id' }));
        expect(result.errors).toContainEqual(expect.objectContaining({ field: 'query.category' }));
        result.errors.forEach((issue) => {
            expect(issue.error.length).toBeGreaterThan(0);
        });
    });
});
