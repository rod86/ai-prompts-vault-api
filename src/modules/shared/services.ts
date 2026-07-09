import config from '@src/config.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/security/BcryptPasswordHasher.js';
import { DateTimeService } from '@src/modules/shared/infrastructure/utils/DateTimeService.js';

export const databaseClient = new DatabaseClient<typeof config.database.schema>(config.database, config.database.schema);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();

export type DrizzleDatabaseConnection = ReturnType<typeof databaseClient.connect>;
