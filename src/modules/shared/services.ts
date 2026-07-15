import config from '@src/config/config.js';
import { type DatabaseSchema, schema } from '@src/config/drizzle/index.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/security/BcryptPasswordHasher.js';
import { DateTimeService } from '@src/modules/shared/infrastructure/utils/DateTimeService.js';
import { UuidGenerator } from '@src/modules/shared/infrastructure/utils/UuidGenerator.js';

export const databaseClient = new DatabaseClient<DatabaseSchema>(config.database, schema);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();
export const idGenerator = new UuidGenerator();
