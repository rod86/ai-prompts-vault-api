import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DatabaseConnection } from '@src/modules/shared/domain/Database.js';


export default interface DatabaseClientInterface<
    Schema extends Record<string, unknown> = Record<string, unknown>,
> {
    connect(): void;
    getConnection(): DatabaseConnection<NodePgDatabase<Schema>>;
    close(): Promise<void>;
}