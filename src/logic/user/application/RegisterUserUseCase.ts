import type PasswordHasherInterface from '@logic/shared/domain/interfaces/PasswordHasherInterface.js';
import { EmailAlreadyInUseError } from '@logic/user/domain/errors/EmailAlreadyInUseError.js';
import type UserRepositoryInterface from '@logic/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@logic/user/domain/User.js';

export interface RegisterUserQuery {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface RegisterUserResponse {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export class RegisterUserUseCase {
    constructor(
        private readonly userRepository: UserRepositoryInterface,
        private readonly passwordHasher: PasswordHasherInterface,
    ) {}

    public async invoke(query: RegisterUserQuery): Promise<RegisterUserResponse> {
        const existingUser = await this.userRepository.findByEmail(query.email);

        if (existingUser) {
            throw new EmailAlreadyInUseError(query.email);
        }

        const passwordHash = await this.passwordHasher.hash(query.password);

        const user: User = {
            id: query.id,
            name: query.name,
            email: query.email,
            passwordHash,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
        };

        await this.userRepository.create(user);

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
