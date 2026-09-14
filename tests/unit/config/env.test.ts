import { describe, expect, it } from 'vitest';
import { parseEnv } from '@src/config/env.js';
import { InvalidEnvironmentError } from '@src/config/InvalidEnvironmentError.js';

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

const requiredEnv = {
    JWT_SECRET: 'a'.repeat(40),
    DATABASE_USER: 'someuser',
    DATABASE_DB: 'somedb',
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

    it('applies the default to every absent optional setting', () => {
        expect(parseEnv(requiredEnv)).toEqual({
            ...requiredEnv,
            ENVIRONMENT: 'development',
            PORT: 3000,
            JWT_EXPIRATION_SECONDS: 3600,
            DATABASE_HOST: 'localhost',
            DATABASE_PORT: 5432,
            DATABASE_PASSWORD: '',
            RATE_LIMIT_WINDOW_MS: 900000,
            RATE_LIMIT_MAX: 100,
            LOGIN_RATE_LIMIT_WINDOW_MS: 900000,
            LOGIN_RATE_LIMIT_MAX: 5,
            TRUST_PROXY_HOPS: 0,
        });
    });

    it('reports every missing required setting together', () => {
        expect(() => parseEnv({})).toThrow(
            new InvalidEnvironmentError({
                errors: [],
                properties: {
                    JWT_SECRET: { errors: ['Invalid input: expected string, received undefined'] },
                    DATABASE_USER: {
                        errors: ['Invalid input: expected string, received undefined'],
                    },
                    DATABASE_DB: { errors: ['Invalid input: expected string, received undefined'] },
                },
            }),
        );
    });
});
