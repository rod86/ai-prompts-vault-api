import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { ApiError } from '@src/errors/ApiError.js';

export default function createRateLimitMiddleware({
    windowMs,
    max,
}: {
    windowMs: number;
    max: number;
}): RateLimitRequestHandler {
    return rateLimit({
        windowMs,
        limit: max,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, _res, next) =>
            next(
                new ApiError(
                    429,
                    'TOO_MANY_REQUESTS',
                    'Too many requests, please try again later.',
                ),
            ),
    });
}
