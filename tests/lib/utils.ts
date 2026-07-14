import jwt from 'jsonwebtoken';
import config from '@src/config/config.js';

type CreateSignedTokenOverrides = {
    sub?: string;
    expiresInSeconds?: number;
    secret?: string;
};

export function createSignedToken({
    sub,
    expiresInSeconds = 3600,
    secret,
}: CreateSignedTokenOverrides = {}): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

    return jwt.sign({ sub, exp }, secret ?? config.jwtSecret, { algorithm: 'HS256' });
}
