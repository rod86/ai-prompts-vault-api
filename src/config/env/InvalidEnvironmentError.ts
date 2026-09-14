import type { z } from 'zod';
import type { Env } from '@src/config/env/env.js';

export class InvalidEnvironmentError extends Error {
    constructor(public readonly details: ReturnType<typeof z.treeifyError<Env>>) {
        super('Invalid environment variables');
        this.name = 'InvalidEnvironmentError';
    }
}
