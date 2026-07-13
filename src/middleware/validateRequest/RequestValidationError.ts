import { type ValidationDetails } from '@src/middleware/validateRequest/validator.js';

class RequestValidationError extends Error {
    constructor(public readonly details: ValidationDetails) {
        super('Request Validation data failed');
        this.name = 'RequestValidationError';
    }
}

export default RequestValidationError;
