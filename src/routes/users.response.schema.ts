import { z } from 'zod';

export const UserResponseSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        created_at: z.iso.datetime(),
        updated_at: z.iso.datetime(),
    })
    .meta({ id: 'User' });

export type UserResponse = z.infer<typeof UserResponseSchema>;
