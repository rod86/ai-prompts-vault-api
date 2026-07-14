import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';

export interface ValidateTokenResponse {
    userId: string;
}

export class ValidateTokenUseCase {
    constructor(
        private readonly tokenVerifier: TokenVerifierInterface,
        private readonly userCredentialsRepository: UserCredentialsRepositoryInterface,
    ) {}

    public async invoke(token: string): Promise<ValidateTokenResponse> {
        const { userId } = await this.tokenVerifier.verifyToken(token);
        await this.userCredentialsRepository.findById(userId);

        return { userId };
    }
}
