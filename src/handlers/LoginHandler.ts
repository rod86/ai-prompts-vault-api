import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { InvalidCredentialsError } from '@logic/auth/domain/errors/InvalidCredentialsError.js';
import { loginUseCase } from '@logic/auth/services.js';
import LoginSchema from '@src/schemas/LoginSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.parsedRequest?.body as z.infer<typeof LoginSchema.body>;

    try {
        const result = await loginUseCase.invoke({ email, password });
        res.status(200).json(result);
    } catch (err) {
        if (err instanceof InvalidCredentialsError) {
            res.status(401).json({ error: err.message });
            return;
        }

        throw err;
    }
};
