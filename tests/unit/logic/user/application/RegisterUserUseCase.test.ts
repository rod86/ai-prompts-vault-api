import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type PasswordHasherInterface from '@logic/shared/domain/interfaces/PasswordHasherInterface.js';
import {
    type RegisterUserQuery,
    RegisterUserUseCase,
} from '@logic/user/application/RegisterUserUseCase.js';
import { EmailAlreadyInUseError } from '@logic/user/domain/errors/EmailAlreadyInUseError.js';
import type UserRepositoryInterface from '@logic/user/domain/interfaces/UserRepositoryInterface.js';
import { type User } from '@logic/user/domain/User.js';

const buildExistingUser = (data: Partial<User> = {}): User => ({
    id: data.id ?? faker.string.uuid(),
    name: data.name ?? faker.person.fullName(),
    email: data.email ?? faker.internet.email(),
    passwordHash: data.passwordHash ?? faker.string.alphanumeric(60),
    createdAt: data.createdAt ?? faker.date.past(),
    updatedAt: data.updatedAt ?? faker.date.past(),
});

const buildQuery = (data: Partial<RegisterUserQuery> = {}): RegisterUserQuery => ({
    id: data.id ?? faker.string.uuid(),
    name: data.name ?? faker.person.fullName(),
    email: data.email ?? faker.internet.email(),
    password: data.password ?? faker.internet.password(),
    createdAt: data.createdAt ?? faker.date.recent(),
    updatedAt: data.updatedAt ?? faker.date.recent(),
});

describe('RegisterUserUseCase', () => {
    let userRepository: MockProxy<UserRepositoryInterface>;
    let passwordHasher: MockProxy<PasswordHasherInterface>;
    let useCase: RegisterUserUseCase;

    beforeEach(() => {
        userRepository = mock<UserRepositoryInterface>();
        passwordHasher = mock<PasswordHasherInterface>();
        useCase = new RegisterUserUseCase(userRepository, passwordHasher);
    });

    it('registers and returns the assembled account when the email is not in use', async () => {
        userRepository.findByEmail.mockResolvedValue(undefined);
        passwordHasher.hash.mockResolvedValue('hashed-password');
        userRepository.create.mockResolvedValue(undefined);
        const query = buildQuery();

        const result = await useCase.invoke(query);

        expect(result).toEqual({
            id: query.id,
            name: query.name,
            email: query.email,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
        });
        expect(passwordHasher.hash).toHaveBeenCalledOnce();
        expect(passwordHasher.hash).toHaveBeenCalledWith(query.password);
        expect(userRepository.create).toHaveBeenCalledOnce();
        expect(userRepository.create).toHaveBeenCalledWith({
            id: query.id,
            name: query.name,
            email: query.email,
            passwordHash: 'hashed-password',
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
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
    });
});
