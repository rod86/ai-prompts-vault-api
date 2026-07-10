import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { type DatabaseConfig, type DatabaseConnection } from '@src/modules/shared/domain/Database.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { DatabaseNotConnectedError } from '@src/modules/shared/infrastructure/database/DatabaseNotConnectedError.js';


export default class DatabaseClient<DatabaseSchema extends Record<string, unknown>>
    implements DatabaseClientInterface<DatabaseSchema>
{
    private pool: Pool | undefined;
    private connection: DatabaseConnection<NodePgDatabase<DatabaseSchema>> | undefined;

    constructor(
        private readonly config: DatabaseConfig,
        private readonly schema: DatabaseSchema,
    ) {}

    public connect(): void {
        if (this.pool === undefined) {
            this.pool = new Pool(this.config);
        }

        if (this.connection === undefined) {
            this.connection = drizzle(this.pool, { schema: this.schema });
        }
    }

    public getConnection(): DatabaseConnection<NodePgDatabase<DatabaseSchema>> {
        if (this.connection === undefined) {
            throw new DatabaseNotConnectedError();
        }

        return this.connection;
    }

    public async close(): Promise<void> {
        if (this.pool === undefined) {
            return;
        }

        await this.pool.end();
        this.pool = undefined;
    }
}
