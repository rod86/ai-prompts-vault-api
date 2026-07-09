import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/BcryptPasswordHasher.js';
import DatabaseClient from '@src/modules/shared/infrastructure/DatabaseClient.js';
import { DateTimeService } from '@src/modules/shared/infrastructure/DateTimeService.js';
import config from '@src/config.js';

export const databaseClient = new DatabaseClient<typeof config.database.schema>(
    config.database,
    config.database.schema,
);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();
