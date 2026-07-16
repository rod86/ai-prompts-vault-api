import path from 'node:path';
import process from 'node:process';

process.loadEnvFile(path.join(import.meta.dirname, '..', '..', '.env'));

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
    },
    rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
        max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    },
    trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
};
