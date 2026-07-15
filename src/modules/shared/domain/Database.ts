export type DatabaseConnection<T = unknown> = T;

export type DatabaseConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};
