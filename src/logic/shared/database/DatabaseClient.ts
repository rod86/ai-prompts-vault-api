import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DatabaseConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export default class DatabaseClient<
    DatabaseConnection,
    DatabaseSchema extends Record<string, unknown> = Record<string, unknown>,
> {
    private pool: Pool | undefined;

    constructor(
        private readonly config: DatabaseConfig,
        private readonly schema: DatabaseSchema,
    ) {}

    public connect(): DatabaseConnection {
        if (this.pool === undefined) {
            this.pool = new Pool(this.config);
        }

        return drizzle(this.pool, { schema: this.schema }) as DatabaseConnection;
    }

    public async close(): Promise<void> {
        if (this.pool === undefined) {
            return;
        }

        await this.pool.end();
        this.pool = undefined;
    }
}
