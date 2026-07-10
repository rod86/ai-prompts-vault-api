import { DatabaseConnection } from '@src/modules/shared/domain/Database.js';


export default interface DatabaseClientInterface<Connection = unknown> {
    connect(): void;
    getConnection(): DatabaseConnection<Connection>;
    close(): Promise<void>;
}