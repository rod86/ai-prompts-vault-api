import { z } from 'zod';
import { emailField } from '@src/routes/shared/fields.schema.js';

export const AuthenticateSchema = z.object({
    body: z.object({
        email: emailField(),
        password: z
            .string({ error: 'Missing required value' })
            .min(8, 'Must be at least 8 characters'),
    }),
});

export type AuthenticateRequest = z.infer<typeof AuthenticateSchema>;
