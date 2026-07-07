import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

const PASSWORD_REQUIREMENT_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
const PASSWORD_REQUIREMENT_MESSAGE =
    'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a digit, and a special character.';

export default {
    body: z.object({
        name: z
            .string({ error: 'Missing required value' })
            .refine((value) => value.trim().length > 0, { error: 'Missing required value' }),
        email: z.email({
            error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid email address'),
        }),
        password: z
            .string({ error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : undefined) })
            .regex(PASSWORD_REQUIREMENT_REGEX, { error: PASSWORD_REQUIREMENT_MESSAGE }),
    }),
} satisfies RequestSchema;
