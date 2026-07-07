import DatabaseClient from '@logic/shared/database/DatabaseClient.js';
import { BcryptPasswordHasher } from '@logic/shared/infrastructure/security/BcryptPasswordHasher.js';
import { DateTimeService } from '@logic/shared/utils/DateTimeService.js';
import config from '@src/config.js';

export const databaseClient = new DatabaseClient<typeof config.database.schema>(
    config.database,
    config.database.schema,
);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();
