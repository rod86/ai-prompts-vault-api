import path from 'node:path';
import process from 'node:process';
import * as legacyPromptSchema from '@logic/prompt/infrastructure/database/schema.js';
import * as legacyUserSchema from '@logic/user/infrastructure/database/schema.js';
import * as promptSchema from '@src/modules/prompt/infrastructure/database/schema.js';

process.loadEnvFile(path.join(import.meta.dirname, '..', '.env'));

export default {
    port: process.env.PORT ?? 3000,
    environment: process.env.ENVIRONMENT ?? 'development',
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpirationSeconds: Number(process.env.JWT_EXPIRATION_SECONDS ?? 3600),
    database: {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        user: process.env.DATABASE_USER ?? '',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_DB ?? '',
        schema: {
            ...legacyPromptSchema,
            ...legacyUserSchema,
            ...promptSchema,
        },
    },
};
