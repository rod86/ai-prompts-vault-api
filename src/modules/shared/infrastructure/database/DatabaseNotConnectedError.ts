export class DatabaseNotConnectedError extends Error {
    constructor() {
        super('Database connection has not been established. Call connect() first.');
        this.name = 'DatabaseNotConnectedError';
    }
}
