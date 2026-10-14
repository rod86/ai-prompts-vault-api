import { defineConfig } from 'drizzle-kit';
import { loadEnvFileIfPresent } from './src/config/env/env.js';

loadEnvFileIfPresent('.env');

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/config/drizzle/schema.ts',
    out: './drizzle',
    dbCredentials: {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        user: process.env.DATABASE_USER ?? '',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_DB ?? '',
        ssl: false,
    },
});
