import { type NodePgDatabase } from 'drizzle-orm/node-postgres';

import DatabaseClient from '@logic/shared/database/DatabaseClient.js';
import config from '@src/config.js';

export const databaseClient = new DatabaseClient<NodePgDatabase<Record<string, unknown>>>(config.database, {});