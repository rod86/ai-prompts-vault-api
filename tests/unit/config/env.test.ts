import { describe, expect, it } from 'vitest';
import { parseEnv } from '@src/config/env.js';

const validEnv = {
    ENVIRONMENT: 'production',
    PORT: '8080',
    JWT_SECRET: 'a'.repeat(40),
    JWT_EXPIRATION_SECONDS: '7200',
    DATABASE_HOST: 'db.example.com',
    DATABASE_PORT: '5433',
    DATABASE_USER: 'someuser',
    DATABASE_PASSWORD: 'super-secret-password',
    DATABASE_DB: 'somedb',
    RATE_LIMIT_WINDOW_MS: '123456',
    RATE_LIMIT_MAX: '50',
    LOGIN_RATE_LIMIT_WINDOW_MS: '54321',
    LOGIN_RATE_LIMIT_MAX: '3',
    TRUST_PROXY_HOPS: '2',
};

describe('parseEnv', () => {
    it('returns a fully valid environment converted to its domain type', () => {
        expect(parseEnv(validEnv)).toEqual({
            ENVIRONMENT: 'production',
            PORT: 8080,
            JWT_SECRET: 'a'.repeat(40),
            JWT_EXPIRATION_SECONDS: 7200,
            DATABASE_HOST: 'db.example.com',
            DATABASE_PORT: 5433,
            DATABASE_USER: 'someuser',
            DATABASE_PASSWORD: 'super-secret-password',
            DATABASE_DB: 'somedb',
            RATE_LIMIT_WINDOW_MS: 123456,
            RATE_LIMIT_MAX: 50,
            LOGIN_RATE_LIMIT_WINDOW_MS: 54321,
            LOGIN_RATE_LIMIT_MAX: 3,
            TRUST_PROXY_HOPS: 2,
        });
    });
});
