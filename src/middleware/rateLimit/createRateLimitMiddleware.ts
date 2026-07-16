import { rateLimit } from 'express-rate-limit';

export default function createRateLimitMiddleware({
    windowMs,
    max,
}: {
    windowMs: number;
    max: number;
}) {
    return rateLimit({
        windowMs,
        limit: max,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
    });
}
