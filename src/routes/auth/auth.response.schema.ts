import { z } from 'zod';

export const AuthenticateResponseSchema = z
    .object({
        token: z.string(),
    })
    .meta({ id: 'AuthToken' });

export type AuthenticateResponse = z.infer<typeof AuthenticateResponseSchema>;
