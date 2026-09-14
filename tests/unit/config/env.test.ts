import os from 'node:os';
import path from 'node:path';
import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { loadEnvFileIfPresent, parseEnv } from '@src/config/env.js';
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

    it('rejects a too-short JWT_SECRET without echoing the supplied secret', () => {
        expect(() => parseEnv({ ...validEnv, JWT_SECRET: 'a'.repeat(31) })).toThrow(
            new InvalidEnvironmentError({
                errors: [],
                properties: {
                    JWT_SECRET: {
                        errors: ['Too small: expected string to have >=32 characters'],
                    },
                },
            }),
        );
    });

    it('rejects non-numeric, zero, fractional, and blank numeric settings', () => {
        expect(() =>
            parseEnv({
                ...validEnv,
                PORT: 'abc',
                DATABASE_PORT: '0',
                RATE_LIMIT_MAX: '1.5',
                LOGIN_RATE_LIMIT_MAX: '',
            }),
        ).toThrow(
            new InvalidEnvironmentError({
                errors: [],
                properties: {
                    PORT: { errors: ['Invalid input: expected number, received NaN'] },
                    DATABASE_PORT: { errors: ['Too small: expected number to be >0'] },
                    RATE_LIMIT_MAX: { errors: ['Invalid input: expected int, received number'] },
                    LOGIN_RATE_LIMIT_MAX: { errors: ['Too small: expected number to be >0'] },
                },
            }),
        );
    });

    it('accepts zero trusted proxy hops', () => {
        expect(parseEnv({ ...validEnv, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS).toBe(0);
    });

    it('rejects negative trusted proxy hops', () => {
        expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: '-1' })).toThrow(
            new InvalidEnvironmentError({
                errors: [],
                properties: {
                    TRUST_PROXY_HOPS: { errors: ['Too small: expected number to be >=0'] },
                },
            }),
        );
    });

    it('rejects an unknown ENVIRONMENT choice', () => {
        expect(() => parseEnv({ ...validEnv, ENVIRONMENT: 'prod' })).toThrow(
            new InvalidEnvironmentError({
                errors: [],
                properties: {
                    ENVIRONMENT: {
                        errors: [
                            'Invalid option: expected one of "development"|"test"|"production"',
                        ],
                    },
                },
            }),
        );
    });

    it('accepts a blank DATABASE_PASSWORD', () => {
        expect(parseEnv({ ...validEnv, DATABASE_PASSWORD: '' }).DATABASE_PASSWORD).toBe('');
    });
});

describe('loadEnvFileIfPresent', () => {
    it('does not throw when the settings file is missing', () => {
        const missingPath = path.join(os.tmpdir(), faker.string.uuid());

        expect(() => loadEnvFileIfPresent(missingPath)).not.toThrow();
    });
});
