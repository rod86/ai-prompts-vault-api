import { type RequestHandler } from 'express';
import { loginUseCase } from '@src/modules/auth/services.js';
import { type AuthenticateResponse } from '@src/routes/auth.response.schema.js';
import { type AuthenticateRequest } from '@src/routes/auth.schema.js';

const authenticateHandler: RequestHandler<Record<string, string>, AuthenticateResponse> = async (
    req,
    res,
) => {
    const { body } = req.parsedRequest as AuthenticateRequest;

    const result = await loginUseCase.invoke({
        email: body.email,
        password: body.password,
    });

    res.status(200).json({ token: result.token });
};

export default authenticateHandler;
