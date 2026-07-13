import * as v from 'valibot';

export type RequestSchema = v.GenericSchema<{ params?: unknown; query?: unknown; body?: unknown }>;

export type ValidationDetails = Partial<Record<'params' | 'query' | 'body', Record<string, string>>>;

export type ValidatorResult<S extends RequestSchema> =
    | { success: true; data: v.InferOutput<S> }
    | { success: false; errors: ValidationDetails };

const groupIssues = (issues: readonly v.BaseIssue<unknown>[]): ValidationDetails => {
    const errors: ValidationDetails = {};

    for (const issue of issues) {
        const [part, ...rest] = issue.path?.map((segment) => String(segment.key)) ?? [];
        if (part !== 'params' && part !== 'query' && part !== 'body') continue;

        const field = rest.length > 0 ? rest.join('.') : part;
        const group = errors[part] ?? {};
        group[field] ??= issue.message;
        errors[part] = group;
    }

    return errors;
};

export const validator = <S extends RequestSchema>(schema: S, input: unknown): ValidatorResult<S> => {
    const result = v.safeParse(schema, input);

    if (result.success) {
        return { success: true, data: result.output };
    }

    return { success: false, errors: groupIssues(result.issues) };
};
