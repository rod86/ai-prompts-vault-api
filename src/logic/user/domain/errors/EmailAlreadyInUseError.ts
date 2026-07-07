export class EmailAlreadyInUseError extends Error {
    constructor(email: string) {
        super(`Email already in use: ${email}`);
        this.name = 'EmailAlreadyInUseError';
    }
}
