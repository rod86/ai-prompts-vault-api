import { type RequestHandler } from 'express';
import { validateTokenUseCase } from '@src/modules/auth/services.js';

const requireAuthMiddleware: RequestHandler = async (req, _res, next) => {
    const authorization = req.headers.authorization ?? '';
    const [scheme, token] = authorization.split(' ');
    const bearerToken = scheme === 'Bearer' ? token : undefined;

    req.auth = await validateTokenUseCase.invoke(bearerToken ?? '');
    next();
};

export default requireAuthMiddleware;
