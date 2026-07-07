import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { LoginUseCase } from '@logic/auth/application/LoginUseCase.js';
import { InvalidCredentialsError } from '@logic/auth/domain/errors/InvalidCredentialsError.js';
import type AuthCryptoInterface from '@logic/auth/domain/interfaces/AuthCryptoInterface.js';
import type UserCredentialsRepositoryInterface from '@logic/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';
import type DateTimeInterface from '@logic/shared/utils/DateTimeInterface.js';

describe('LoginUseCase', () => {
    const tokenExpirationSeconds = 3600;
    let userCredentialsRepository: MockProxy<UserCredentialsRepositoryInterface>;
    let authCrypto: MockProxy<AuthCryptoInterface>;
    let dateService: MockProxy<DateTimeInterface>;
    let useCase: LoginUseCase;

    beforeEach(() => {
        userCredentialsRepository = mock<UserCredentialsRepositoryInterface>();
        authCrypto = mock<AuthCryptoInterface>();
        dateService = mock<DateTimeInterface>();
        useCase = new LoginUseCase(userCredentialsRepository, authCrypto, dateService, tokenExpirationSeconds);
    });

    it('issues a token when the email and password both match', async () => {
        userCredentialsRepository.findByEmail.mockResolvedValue({
            id: 'fixture-id',
            email: 'a@b.com',
            passwordHash: 'hash',
        });
        authCrypto.verifyPassword.mockResolvedValue(true);
        dateService.now.mockReturnValue(new Date('2026-01-01T00:00:00.000Z'));
        authCrypto.issueToken.mockResolvedValue('signed-token');

        const result = await useCase.invoke({ email: 'a@b.com', password: 'p' });

        expect(result).toEqual({ token: 'signed-token' });
        expect(authCrypto.verifyPassword).toHaveBeenCalledWith('p', 'hash');
        expect(authCrypto.issueToken).toHaveBeenCalledOnce();
        expect(authCrypto.issueToken).toHaveBeenCalledWith('fixture-id', new Date('2026-01-01T01:00:00.000Z'));
    });

    it('throws InvalidCredentialsError when no account matches the email', async () => {
        userCredentialsRepository.findByEmail.mockResolvedValue(undefined);

        await expect(useCase.invoke({ email: 'unknown@example.com', password: 'p' })).rejects.toThrow(
            InvalidCredentialsError,
        );
        await expect(useCase.invoke({ email: 'unknown@example.com', password: 'p' })).rejects.toThrow(
            'Invalid authentication credentials',
        );
        expect(authCrypto.verifyPassword).not.toHaveBeenCalled();
        expect(authCrypto.issueToken).not.toHaveBeenCalled();
    });

    it('throws InvalidCredentialsError when the password does not match', async () => {
        userCredentialsRepository.findByEmail.mockResolvedValue({
            id: 'fixture-id',
            email: 'a@b.com',
            passwordHash: 'hash',
        });
        authCrypto.verifyPassword.mockResolvedValue(false);

        await expect(useCase.invoke({ email: 'a@b.com', password: 'wrong-password' })).rejects.toThrow(
            InvalidCredentialsError,
        );
        await expect(useCase.invoke({ email: 'a@b.com', password: 'wrong-password' })).rejects.toThrow(
            'Invalid authentication credentials',
        );
        expect(authCrypto.issueToken).not.toHaveBeenCalled();
    });
});
