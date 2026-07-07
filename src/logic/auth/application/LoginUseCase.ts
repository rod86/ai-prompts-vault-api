import { InvalidCredentialsError } from '@logic/auth/domain/errors/InvalidCredentialsError.js';
import type AuthCryptoInterface from '@logic/auth/domain/interfaces/AuthCryptoInterface.js';
import type UserCredentialsRepositoryInterface from '@logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import type DateTimeInterface from '@logic/shared/utils/DateTimeInterface.js';

export interface LoginQuery {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
}

export class LoginUseCase {
    constructor(
        private readonly userCredentialsRepository: UserCredentialsRepositoryInterface,
        private readonly authCrypto: AuthCryptoInterface,
        private readonly dateService: DateTimeInterface,
        private readonly tokenExpirationSeconds: number,
    ) {}

    public async invoke(query: LoginQuery): Promise<LoginResponse> {
        const credentials = await this.userCredentialsRepository.findByEmail(query.email);

        if (!credentials) {
            throw new InvalidCredentialsError();
        }

        const passwordMatches = await this.authCrypto.verifyPassword(query.password, credentials.passwordHash);

        if (!passwordMatches) {
            throw new InvalidCredentialsError();
        }

        const expiresAt = new Date(this.dateService.now().getTime() + this.tokenExpirationSeconds * 1000);
        const token = await this.authCrypto.issueToken(credentials.id, expiresAt);

        return { token };
    }
}
