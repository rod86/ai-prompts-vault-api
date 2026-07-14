import { z } from 'zod';

export const AuthenticateSchema = z.object({
    body: z.object({
        email: z.email({
            error: (issue) =>
                issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid email value',
        }),
        password: z
            .string({ error: 'Missing required value' })
            .min(8, 'Must be at least 8 characters'),
    }),
});

export type AuthenticateRequest = z.infer<typeof AuthenticateSchema>;
