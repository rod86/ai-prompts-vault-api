import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import type IdGeneratorInterface from '@src/modules/shared/domain/interfaces/IdGeneratorInterface.js';
import type PasswordHasherInterface from '@src/modules/shared/domain/interfaces/PasswordHasherInterface.js';
import type PasswordStrengthCheckerInterface from '@src/modules/shared/domain/interfaces/PasswordStrengthCheckerInterface.js';
import { EmailAlreadyInUseError } from '@src/modules/user/domain/errors/EmailAlreadyInUseError.js';
import { UserCreationError } from '@src/modules/user/domain/errors/UserCreationError.js';
import { WeakPasswordError } from '@src/modules/user/domain/errors/WeakPasswordError.js';
import type UserRepositoryInterface from '@src/modules/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@src/modules/user/domain/User.js';

export interface RegisterUserQuery {
    name: string;
    email: string;
    password: string;
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
        private readonly dateTime: DateTimeInterface,
        private readonly idGenerator: IdGeneratorInterface,
        private readonly passwordStrengthChecker: PasswordStrengthCheckerInterface,
    ) {}

    public async invoke(query: RegisterUserQuery): Promise<RegisterUserResponse> {
        if (!this.passwordStrengthChecker.isStrong(query.password)) {
            throw new WeakPasswordError();
        }

        const existingUser = await this.userRepository.findByEmail(query.email);

        if (existingUser) {
            throw new EmailAlreadyInUseError(query.email);
        }

        const passwordHash = await this.passwordHasher.hash(query.password);
        const now = this.dateTime.now();

        const user: User = {
            id: this.idGenerator.generate(),
            name: query.name,
            email: query.email,
            passwordHash,
            createdAt: now,
            updatedAt: now,
        };

        try {
            await this.userRepository.create(user);
        } catch (error) {
            throw new UserCreationError(user.id, error);
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
