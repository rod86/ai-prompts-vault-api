import 'express';
import type { ValidateTokenResponse } from '@src/modules/auth/application/ValidateTokenUseCase.js';

declare global {
    namespace Express {
        interface Request {
            parsedRequest?: unknown;
            auth?: ValidateTokenResponse;
        }
    }
}
