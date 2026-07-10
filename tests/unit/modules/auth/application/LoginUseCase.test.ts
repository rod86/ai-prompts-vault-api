import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { LoginUseCase } from '@src/modules/auth/application/LoginUseCase.js';
import { InvalidCredentialsError } from '@src/modules/auth/domain/errors/InvalidCredentialsError.js';
import type TokenIssuerInterface from '@src/modules/auth/domain/interfaces/TokenIssuerInterface.js';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import type PasswordHasherInterface from '@src/modules/shared/domain/interfaces/PasswordHasherInterface.js';

describe('LoginUseCase', () => {
    const tokenExpirationSeconds = 3600;
    let userCredentialsRepository: MockProxy<UserCredentialsRepositoryInterface>;
    let passwordHasher: MockProxy<PasswordHasherInterface>;
    let tokenIssuer: MockProxy<TokenIssuerInterface>;
    let dateService: MockProxy<DateTimeInterface>;
    let useCase: LoginUseCase;

    beforeEach(() => {
        userCredentialsRepository = mock<UserCredentialsRepositoryInterface>();
        passwordHasher = mock<PasswordHasherInterface>();
        tokenIssuer = mock<TokenIssuerInterface>();
        dateService = mock<DateTimeInterface>();
        useCase = new LoginUseCase(
            userCredentialsRepository,
            passwordHasher,
            tokenIssuer,
            dateService,
            tokenExpirationSeconds,
        );
    });

    it('issues a token when the email and password both match', async () => {
        userCredentialsRepository.findByEmail.mockResolvedValue({
            id: 'fixture-id',
            email: 'a@b.com',
            passwordHash: 'hash',
        });
        passwordHasher.compare.mockResolvedValue(true);
        dateService.now.mockReturnValue(new Date('2026-01-01T00:00:00.000Z'));
        tokenIssuer.issueToken.mockResolvedValue('signed-token');

        const result = await useCase.invoke({ email: 'a@b.com', password: 'p' });

        expect(result).toEqual({ token: 'signed-token' });
        expect(passwordHasher.compare).toHaveBeenCalledWith('p', 'hash');
        expect(tokenIssuer.issueToken).toHaveBeenCalledOnce();
        expect(tokenIssuer.issueToken).toHaveBeenCalledWith('fixture-id', new Date('2026-01-01T01:00:00.000Z'));
    });

    it('throws InvalidCredentialsError when no account matches the email', async () => {
        userCredentialsRepository.findByEmail.mockResolvedValue(undefined);

        await expect(useCase.invoke({ email: 'unknown@example.com', password: 'p' })).rejects.toThrow(
            InvalidCredentialsError,
        );
        await expect(useCase.invoke({ email: 'unknown@example.com', password: 'p' })).rejects.toThrow(
            'Invalid authentication credentials',
        );
        expect(passwordHasher.compare).not.toHaveBeenCalled();
        expect(tokenIssuer.issueToken).not.toHaveBeenCalled();
    });

    it('throws InvalidCredentialsError when the password does not match', async () => {
        userCredentialsRepository.findByEmail.mockResolvedValue({
            id: 'fixture-id',
            email: 'a@b.com',
            passwordHash: 'hash',
        });
        passwordHasher.compare.mockResolvedValue(false);

        await expect(useCase.invoke({ email: 'a@b.com', password: 'wrong-password' })).rejects.toThrow(
            InvalidCredentialsError,
        );
        await expect(useCase.invoke({ email: 'a@b.com', password: 'wrong-password' })).rejects.toThrow(
            'Invalid authentication credentials',
        );
        expect(tokenIssuer.issueToken).not.toHaveBeenCalled();
    });
});
