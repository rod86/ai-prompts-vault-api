import path from 'node:path';
import process from 'node:process';
import { loadEnvFileIfPresent, parseEnv, type Env } from '@src/config/env.js';
import { InvalidEnvironmentError } from '@src/config/InvalidEnvironmentError.js';

function loadEnv(): Env {
    try {
        return parseEnv(process.env);
    } catch (error) {
        if (error instanceof InvalidEnvironmentError) {
            console.error(
                '❌ Invalid environment variables:',
                JSON.stringify(error.details, null, 4),
            );
            process.exit(1);
        }
        throw error;
    }
}

loadEnvFileIfPresent(path.join(import.meta.dirname, '..', '..', '.env'));
const env = loadEnv();

export default {
    port: env.PORT,
    environment: env.ENVIRONMENT,
    jwtSecret: env.JWT_SECRET,
    jwtExpirationSeconds: env.JWT_EXPIRATION_SECONDS,
    database: {
        host: env.DATABASE_HOST,
        port: env.DATABASE_PORT,
        user: env.DATABASE_USER,
        password: env.DATABASE_PASSWORD,
        database: env.DATABASE_DB,
    },
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
    },
    loginRateLimit: {
        windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
        max: env.LOGIN_RATE_LIMIT_MAX,
    },
    trustProxyHops: env.TRUST_PROXY_HOPS,
};
