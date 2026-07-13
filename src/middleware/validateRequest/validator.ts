import * as v from 'valibot';

export type RequestSchema = v.GenericSchema<{ params?: unknown; query?: unknown; body?: unknown }>;

export type ValidationDetails = Partial<Record<'params' | 'query' | 'body', Record<string, string>>>;

export type ValidatorResult<S extends RequestSchema> =
    | { success: true; data: v.InferOutput<S> }
    | { success: false; errors: ValidationDetails };

export const validator = <S extends RequestSchema>(schema: S, input: unknown): ValidatorResult<S> => {
    const result = v.safeParse(schema, input);

    if (result.success) {
        return { success: true, data: result.output };
    }

    return { success: false, errors: {} };
};
