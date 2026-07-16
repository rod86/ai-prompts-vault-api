import { type NextFunction, type Request, type Response } from 'express';
import { ApiError } from '@src/errors/ApiError.js';

const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
    next(new ApiError(404, 'NOT_FOUND', `Cannot ${req.method} ${req.path}`));
};

export default notFoundMiddleware;
