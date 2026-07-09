import { type NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DatabaseConnection<DatabaseSchema extends Record<string, unknown> = Record<string, unknown>> =
    NodePgDatabase<DatabaseSchema>;

export default interface DatabaseClientInterface<DatabaseSchema extends Record<string, unknown>> {
    connect(): DatabaseConnection<DatabaseSchema>;
    close(): Promise<void>;
}
