import DatabaseClient from '@logic/shared/database/DatabaseClient.js';
import config from '@src/config.js';
import { PromptCategoryModelFactory } from '@tests/lib/modelFactories/PromptCategoryModelFactory.js';
import { PromptModelFactory } from '@tests/lib/modelFactories/PromptModelFactory.js';

export const databaseClient = new DatabaseClient<typeof config.database.schema>(config.database, config.database.schema);
export type TestDatabaseConnection = ReturnType<typeof databaseClient.connect>;

export const promptCategoryModelFactory = new PromptCategoryModelFactory();
export const promptModelFactory = new PromptModelFactory();





