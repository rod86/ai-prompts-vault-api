import { InvalidCredentialsError } from '@src/modules/auth/domain/errors/InvalidCredentialsError.js';
import type TokenIssuerInterface from '@src/modules/auth/domain/interfaces/TokenIssuerInterface.js';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import type PasswordHasherInterface from '@src/modules/shared/domain/interfaces/PasswordHasherInterface.js';

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
        private readonly passwordHasher: PasswordHasherInterface,
        private readonly tokenIssuer: TokenIssuerInterface,
        private readonly dateTime: DateTimeInterface,
        private readonly tokenExpirationSeconds: number,
    ) {}

    public async invoke(query: LoginQuery): Promise<LoginResponse> {
        const credentials = await this.userCredentialsRepository.findByEmail(query.email);

        if (!credentials) {
            throw new InvalidCredentialsError();
        }

        const passwordMatches = await this.passwordHasher.compare(
            query.password,
            credentials.passwordHash,
        );

        if (!passwordMatches) {
            throw new InvalidCredentialsError();
        }

        const expiresAt = new Date(
            this.dateTime.now().getTime() + this.tokenExpirationSeconds * 1000,
        );
        const token = await this.tokenIssuer.issueToken(credentials.id, expiresAt);

        return { token };
    }
}
