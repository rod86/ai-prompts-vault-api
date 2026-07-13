import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { validator } from '@src/middleware/validateRequest/validator.js';

describe('validator', () => {
    it('returns a success result containing exactly the declared parts, normalized', () => {
        const schema = v.object({
            params: v.object({ id: v.string() }),
            query: v.object({ page: v.string() }),
            body: v.object({ name: v.string() }),
        });
        const input = {
            params: { id: 'abc-123' },
            query: { page: '2' },
            body: { name: 'a prompt' },
        };

        const result = validator(schema, input);

        expect(result).toEqual({
            success: true,
            data: {
                params: { id: 'abc-123' },
                query: { page: '2' },
                body: { name: 'a prompt' },
            },
        });
    });

    it('omits an undeclared part from data even when the input supplies it', () => {
        const schema = v.object({
            params: v.object({ id: v.string() }),
            body: v.object({ name: v.string() }),
        });
        const input = {
            params: { id: 'abc-123' },
            query: { page: '2' },
            body: { name: 'a prompt' },
        };

        const result = validator(schema, input);

        expect(result).toEqual({
            success: true,
            data: {
                params: { id: 'abc-123' },
                body: { name: 'a prompt' },
            },
        });
        expect(result.success && 'query' in result.data).toBe(false);
    });
});
