declare global {
    namespace Express {
        interface Request {
            parsedRequest?: unknown;
        }
    }
}

export {};
