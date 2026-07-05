import type { RequestData } from '@src/middleware/validateRequest/validation.js';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            parsedRequest?: RequestData;
        }
    }
}

export {};
