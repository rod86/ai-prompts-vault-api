import { type RequestHandler } from 'express';
import { registerUserUseCase } from '@src/modules/user/services.js';
import { type CreateUserRequest } from '@src/routes/users/users.request.schema.js';
import { type UserResponse } from '@src/routes/users/users.response.schema.js';

const createUserHandler: RequestHandler<Record<string, string>, UserResponse> = async (
    req,
    res,
) => {
    const { body } = req.parsedRequest as CreateUserRequest;

    const user = await registerUserUseCase.invoke({
        name: body.name,
        email: body.email,
        password: body.password,
    });

    res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
    });
};

export default createUserHandler;
