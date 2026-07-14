import { type RequestHandler } from 'express';
import { MissingTokenError } from '@src/modules/auth/domain/errors/MissingTokenError.js';
import { validateTokenUseCase } from '@src/modules/auth/services.js';

const requireAuthMiddleware: RequestHandler = async (req, _res, next) => {
    const authorization = req.headers.authorization ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        throw new MissingTokenError();
    }

    req.auth = await validateTokenUseCase.invoke(token);
    next();
};

export default requireAuthMiddleware;
