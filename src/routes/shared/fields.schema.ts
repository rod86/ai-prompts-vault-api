import { z } from 'zod';

export const uuidField = () =>
    z.uuid({
        error: (issue) =>
            issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value',
    });

export const emailField = () =>
    z.email({
        error: (issue) =>
            issue.code === 'invalid_type' ? 'Missing required value' : 'Invalid email value',
    });
