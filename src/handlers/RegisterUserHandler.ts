import { randomUUID } from 'node:crypto';
import { type Request, type Response } from 'express';
import { type z } from 'zod';
import { EmailAlreadyInUseError } from '@logic/user/domain/errors/EmailAlreadyInUseError.js';
import { registerUserUseCase } from '@logic/user/services.js';
import RegisterUserSchema from '@src/schemas/RegisterUserSchema.js';

export default async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.parsedRequest?.body as z.infer<typeof RegisterUserSchema.body>;

    try {
        const now = new Date();
        const registeredUser = await registerUserUseCase.invoke({
            id: randomUUID(),
            name,
            email,
            password,
            createdAt: now,
            updatedAt: now,
        });
        res.status(201).json(registeredUser);
    } catch (err) {
        if (err instanceof EmailAlreadyInUseError) {
            res.status(409).json({ error: err.message });
            return;
        }

        throw err;
    }
};
