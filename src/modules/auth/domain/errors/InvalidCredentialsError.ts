export class InvalidCredentialsError extends Error {
    constructor() {
        super('Invalid authentication credentials');
        this.name = 'InvalidCredentialsError';
    }
}
