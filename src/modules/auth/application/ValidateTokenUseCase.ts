import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';

export interface ValidateTokenResponse {
    userId: string;
}

export class ValidateTokenUseCase {
    constructor(private readonly tokenVerifier: TokenVerifierInterface) {}

    public async invoke(token: string): Promise<ValidateTokenResponse> {
        return this.tokenVerifier.verifyToken(token);
    }
}
