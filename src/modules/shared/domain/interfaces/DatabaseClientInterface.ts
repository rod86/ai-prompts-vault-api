import { DatabaseConnection } from '@src/modules/shared/domain/Database.js';


export default interface DatabaseClientInterface {
    connect(): DatabaseConnection;
    close(): Promise<void>;
}