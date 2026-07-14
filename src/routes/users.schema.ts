import { z } from 'zod';

export const CreateUserSchema = z.object({
    body: z.object({
        name: z.string({ error: 'Missing required value' }).min(1, 'Missing required value'),
        email: z.email({
            error: (issue) =>
                issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid email value',
        }),
        password: z
            .string({ error: 'Missing required value' })
            .min(8, 'Must be at least 8 characters'),
    }),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
