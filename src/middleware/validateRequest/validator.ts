import { type z, type ZodType } from 'zod';

export type RequestSchema = ZodType<{ params?: unknown; query?: unknown; body?: unknown }>;

export type ValidationDetails = Partial<Record<'params' | 'query' | 'body', Record<string, string>>>;

export type ValidatorResult<S extends RequestSchema> =
    | { success: true; data: z.infer<S> }
    | { success: false; errors: ValidationDetails };

function validator<S extends RequestSchema>(schema: S, input: unknown): ValidatorResult<S> {
    const result = schema.safeParse(input);

    if (!result.success) {
        return { success: false, errors: {} };
    }

    return { success: true, data: result.data };
}

export default validator;
