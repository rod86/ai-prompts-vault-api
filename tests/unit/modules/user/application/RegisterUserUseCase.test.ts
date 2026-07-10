import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import type IdGeneratorInterface from '@src/modules/shared/domain/interfaces/IdGeneratorInterface.js';
import type PasswordHasherInterface from '@src/modules/shared/domain/interfaces/PasswordHasherInterface.js';
import {
    type RegisterUserQuery,
    RegisterUserUseCase,
} from '@src/modules/user/application/RegisterUserUseCase.js';
import { EmailAlreadyInUseError } from '@src/modules/user/domain/errors/EmailAlreadyInUseError.js';
import type UserRepositoryInterface from '@src/modules/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@src/modules/user/domain/User.js';

const buildExistingUser = (data: Partial<User> = {}): User => ({
    id: data.id ?? faker.string.uuid(),
    name: data.name ?? faker.person.fullName(),
    email: data.email ?? faker.internet.email(),
    passwordHash: data.passwordHash ?? faker.string.alphanumeric(60),
    createdAt: data.createdAt ?? faker.date.past(),
    updatedAt: data.updatedAt ?? faker.date.past(),
});

const buildQuery = (data: Partial<RegisterUserQuery> = {}): RegisterUserQuery => ({
    name: data.name ?? faker.person.fullName(),
    email: data.email ?? faker.internet.email(),
    password: data.password ?? faker.internet.password(),
});

describe('RegisterUserUseCase', () => {
    let userRepository: MockProxy<UserRepositoryInterface>;
    let passwordHasher: MockProxy<PasswordHasherInterface>;
    let dateTime: MockProxy<DateTimeInterface>;
    let idGenerator: MockProxy<IdGeneratorInterface>;
    let useCase: RegisterUserUseCase;
    const generatedId = faker.string.uuid();
    const now = faker.date.recent();

    beforeEach(() => {
        userRepository = mock<UserRepositoryInterface>();
        passwordHasher = mock<PasswordHasherInterface>();
        dateTime = mock<DateTimeInterface>();
        idGenerator = mock<IdGeneratorInterface>();
        dateTime.now.mockReturnValue(now);
        idGenerator.generate.mockReturnValue(generatedId);
        useCase = new RegisterUserUseCase(userRepository, passwordHasher, dateTime, idGenerator);
    });

    it('registers and returns the assembled account with a self-assigned id and timestamps', async () => {
        userRepository.findByEmail.mockResolvedValue(undefined);
        passwordHasher.hash.mockResolvedValue('hashed-password');
        userRepository.create.mockResolvedValue(undefined);
        const query = buildQuery();

        const result = await useCase.invoke(query);

        expect(result).toEqual({
            id: generatedId,
            name: query.name,
            email: query.email,
            createdAt: now,
            updatedAt: now,
        });
        expect(passwordHasher.hash).toHaveBeenCalledOnce();
        expect(passwordHasher.hash).toHaveBeenCalledWith(query.password);
        expect(userRepository.create).toHaveBeenCalledOnce();
        expect(userRepository.create).toHaveBeenCalledWith({
            id: generatedId,
            name: query.name,
            email: query.email,
            passwordHash: 'hashed-password',
            createdAt: now,
            updatedAt: now,
        });
    });

    it('throws EmailAlreadyInUseError and does not persist when the email is already in use', async () => {
        const existingUser = buildExistingUser();
        userRepository.findByEmail.mockResolvedValue(existingUser);
        const query = buildQuery();

        await expect(useCase.invoke(query)).rejects.toThrow(EmailAlreadyInUseError);
        await expect(useCase.invoke(query)).rejects.toThrow(`Email already in use: ${query.email}`);
        expect(passwordHasher.hash).not.toHaveBeenCalled();
        expect(userRepository.create).not.toHaveBeenCalled();
        expect(dateTime.now).not.toHaveBeenCalled();
        expect(idGenerator.generate).not.toHaveBeenCalled();
    });
});
