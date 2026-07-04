import path from "node:path";
import process from "node:process";
import * as promptSchema from '@logic/prompt/infrastructure/database/schema.js';

process.loadEnvFile(path.join(import.meta.dirname, '..', '.env'));

export default {
    port: process.env.PORT ?? 3000,
    environment: process.env.ENVIRONMENT ?? 'development',
    database: {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        user: process.env.DATABASE_USER ?? '',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_DB ?? '',
        schema: { ...promptSchema },
    },
}