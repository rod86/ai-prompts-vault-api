import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { type DatabaseConnection } from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';

export type DatabaseConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export default class DatabaseClient<DatabaseSchema extends Record<string, unknown>>
    implements DatabaseClientInterface<DatabaseSchema>
{
    private pool: Pool | undefined;

    constructor(
        private readonly config: DatabaseConfig,
        private readonly schema: DatabaseSchema,
    ) {}

    public connect(): DatabaseConnection<DatabaseSchema> {
        if (this.pool === undefined) {
            this.pool = new Pool(this.config);
        }

        return drizzle(this.pool, { schema: this.schema });
    }

    public async close(): Promise<void> {
        if (this.pool === undefined) {
            return;
        }

        await this.pool.end();
        this.pool = undefined;
    }
}
