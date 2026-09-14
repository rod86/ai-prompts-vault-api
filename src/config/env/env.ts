import { existsSync } from 'node:fs';
import process from 'node:process';
import { z } from 'zod';
import { InvalidEnvironmentError } from '@src/config/env/InvalidEnvironmentError.js';

export const EnvSchema = z.object({
    ENVIRONMENT: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(3600),
    DATABASE_HOST: z.string().default('localhost'),
    DATABASE_PORT: z.coerce.number().int().positive().default(5432),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().default(''),
    DATABASE_DB: z.string().min(1),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
});

export type Env = z.output<typeof EnvSchema>;

export function parseEnv(env: NodeJS.ProcessEnv): Env {
    const result = EnvSchema.safeParse(env);
    if (!result.success) {
        throw new InvalidEnvironmentError(z.treeifyError(result.error));
    }
    return result.data;
}

export function loadEnvFileIfPresent(filePath: string): void {
    if (existsSync(filePath)) {
        process.loadEnvFile(filePath);
    }
}
