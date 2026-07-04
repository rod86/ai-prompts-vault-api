import DatabaseClient from '@logic/shared/database/DatabaseClient.js';
import config from '@src/config.js';

export const databaseClient = new DatabaseClient(config.database, config.database.schema);