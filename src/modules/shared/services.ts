import config from '@src/config.js';
import type DatabaseClientInterface from '@src/modules/shared/domain/interfaces/DatabaseClientInterface.js';
import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/BcryptPasswordHasher.js';
import DatabaseClient from '@src/modules/shared/infrastructure/DatabaseClient.js';
import { DateTimeService } from '@src/modules/shared/infrastructure/DateTimeService.js';

export const databaseClient: DatabaseClientInterface<typeof config.database.schema> =
    new DatabaseClient<typeof config.database.schema>(config.database, config.database.schema);
export const passwordHasher = new BcryptPasswordHasher();
export const dateTimeService = new DateTimeService();
