import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { RateLimitExceededError } from '@src/middleware/rateLimit/RateLimitExceededError.js';

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
        handler: (_req, _res, next) => next(new RateLimitExceededError()),
    });
}
