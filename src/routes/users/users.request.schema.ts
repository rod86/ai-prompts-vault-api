import { z } from 'zod';
import { emailField } from '@src/routes/shared/fields.schema.js';

const ALLOWED_SPECIAL_CHARACTER_CLASS = '!"#$%&\'()*+,\\-./:;<=>?@[\\\\\\]^_`{|}~';
const ALLOWED_SPECIAL_CHARACTER_REGEX = new RegExp(`[${ALLOWED_SPECIAL_CHARACTER_CLASS}]`);
const ALLOWED_CHARACTERS_ONLY_REGEX = new RegExp(
    `^[A-Za-z0-9${ALLOWED_SPECIAL_CHARACTER_CLASS}]+$`,
);

export const CreateUserSchema = z.object({
    body: z.object({
        name: z.string({ error: 'Missing required value' }).min(1, 'Missing required value'),
        email: emailField(),
        password: z
            .string({ error: 'Missing required value' })
            .min(8, 'Must be at least 8 characters')
            .max(64, 'Must be at most 64 characters')
            .regex(/[a-z]/, 'Must contain at least one lowercase letter')
            .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Must contain at least one digit')
            .regex(ALLOWED_SPECIAL_CHARACTER_REGEX, 'Must contain at least one special character')
            .regex(
                ALLOWED_CHARACTERS_ONLY_REGEX,
                'Must contain only letters, digits, and allowed special characters',
            )
            .meta({
                description:
                    'Password should have at least 8 characters including uppercase, lowercase and a symbol.',
            }),
    }),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
