import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ValidateTokenUseCase } from '@src/modules/auth/application/ValidateTokenUseCase.js';
import { InvalidTokenError } from '@src/modules/auth/domain/errors/InvalidTokenError.js';
import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';

describe('ValidateTokenUseCase', () => {
    let tokenVerifier: MockProxy<TokenVerifierInterface>;
    let userCredentialsRepository: MockProxy<UserCredentialsRepositoryInterface>;
    let useCase: ValidateTokenUseCase;
    const TOKEN = 'bza1JBLJSr5tpwMCKvZIpjWpwjYggcgHRVMPYpIXAsbxwOYkM1pmRaDuwPo8ZVkb';

    beforeEach(() => {
        tokenVerifier = mock<TokenVerifierInterface>();
        userCredentialsRepository = mock<UserCredentialsRepositoryInterface>();
        useCase = new ValidateTokenUseCase(tokenVerifier, userCredentialsRepository);
    });

    it('resolves the caller identity for a valid token', async () => {
        const userId = faker.string.uuid();
        tokenVerifier.verifyToken.mockResolvedValue({ userId });
        userCredentialsRepository.findById.mockResolvedValue({
            id: userId,
            email: 'ada@example.com',
            passwordHash: 'hash',
        });

        const result = await useCase.invoke(TOKEN);

        expect(result).toEqual({ userId });
        expect(tokenVerifier.verifyToken).toHaveBeenCalledWith(TOKEN);
        expect(userCredentialsRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('rejects with InvalidTokenError when the token identifies no existing user', async () => {
        const userId = faker.string.uuid();
        tokenVerifier.verifyToken.mockResolvedValue({ userId });
        userCredentialsRepository.findById.mockResolvedValue(undefined);

        await expect(useCase.invoke(TOKEN)).rejects.toThrow(InvalidTokenError);
    });
});
