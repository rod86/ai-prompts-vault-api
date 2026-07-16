export type ErrorCategory =
    | 'NotFound'
    | 'Forbidden'
    | 'Unauthorized'
    | 'Unprocessable'
    | 'TooManyRequests';

export abstract class DomainError extends Error {
    abstract readonly code: string;
    abstract readonly category: ErrorCategory;

    protected constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}
