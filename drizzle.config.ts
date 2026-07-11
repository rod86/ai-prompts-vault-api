import process from 'node:process';
import { defineConfig } from 'drizzle-kit';

process.loadEnvFile();

export default defineConfig({
    dialect: 'postgresql',
    schema: [
        './src/modules/prompt/infrastructure/database/schema.ts',
        './src/modules/user/infrastructure/database/schema.ts',
    ],
    out: './drizzle',
    dbCredentials: {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        user: process.env.DATABASE_USER ?? '',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_DB ?? '',
    },
});
