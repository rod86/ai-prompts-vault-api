import { z } from 'zod';

/**
 * Single source of truth for environment configuration.
 *
 * Every environment variable the app reads is declared, validated and typed
 * here. Nothing else in the codebase should touch `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`. Throws a readable error on misconfig so
 * the process fails fast at startup rather than at first request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

export const env: Env = loadEnv();
