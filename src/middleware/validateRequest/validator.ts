import { type z, type ZodType } from 'zod';

type RequestPart = 'params' | 'query' | 'body';

export type RequestSchema = ZodType<{ params?: unknown; query?: unknown; body?: unknown }>;

export type ValidationDetails = Partial<Record<RequestPart, Record<string, string>>>;

export type ValidatorResult<S extends RequestSchema> =
    | { success: true; data: z.infer<S> }
    | { success: false; errors: ValidationDetails };

function groupIssues(issues: z.core.$ZodIssue[]): ValidationDetails {
    const errors: ValidationDetails = {};

    for (const issue of issues) {
        const [part, ...rest] = issue.path as [RequestPart, ...(string | number)[]];
        const field = rest.length > 0 ? rest.join('.') : part;
        const group = (errors[part] ??= {});
        group[field] ??= issue.message;
    }

    return errors;
}

function validator<S extends RequestSchema>(schema: S, input: unknown): ValidatorResult<S> {
    const result = schema.safeParse(input);

    if (!result.success) {
        return { success: false, errors: groupIssues(result.error.issues) };
    }

    return { success: true, data: result.data };
}

export default validator;
