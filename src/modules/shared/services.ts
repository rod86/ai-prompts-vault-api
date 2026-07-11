import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import config from '@src/config/config.js';
import schema from '@src/config/drizzle-schema.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/security/BcryptPasswordHasher.js';
import { DateTimeService } from '@src/modules/shared/infrastructure/utils/DateTimeService.js';
import { UuidGenerator } from '@src/modules/shared/infrastructure/utils/UuidGenerator.js';

export type DatabaseSchema = typeof schema;
export type DatabaseConnection = NodePgDatabase<DatabaseSchema>;

export const databaseClient = new DatabaseClient<DatabaseSchema>(config.database, schema);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();
export const idGenerator = new UuidGenerator();
