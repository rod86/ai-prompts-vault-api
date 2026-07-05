import { z, type ZodTypeAny } from 'zod';

export type RequestSchema = {
    params?: ZodTypeAny;
    query?: ZodTypeAny;
    body?: ZodTypeAny;
};

export type RequestData<T extends RequestSchema = RequestSchema> = z.infer<z.ZodObject<T>>;

export interface RequestValidationIssue {
    field: string;
    error: string;
}

export type RequestValidationResult<T extends RequestSchema = RequestSchema> =
    | { valid: true; data: RequestData<T> }
    | { valid: false; errors: RequestValidationIssue[] };

export function validate<T extends RequestSchema>(data: unknown, schema: T): RequestValidationResult<T> {
    const result = z.object(schema).safeParse(data);

    if (!result.success) {
        return {
            valid: false,
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                error: issue.message,
            })),
        };
    }

    return { valid: true, data: result.data };
}
