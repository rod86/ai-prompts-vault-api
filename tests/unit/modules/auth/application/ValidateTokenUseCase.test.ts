import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ValidateTokenUseCase } from '@src/modules/auth/application/ValidateTokenUseCase.js';
import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';
import type UserCredentialsRepositoryInterface from '@src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.js';

describe('ValidateTokenUseCase', () => {
    let tokenVerifier: MockProxy<TokenVerifierInterface>;
    let userCredentialsRepository: MockProxy<UserCredentialsRepositoryInterface>;
    let useCase: ValidateTokenUseCase;

    beforeEach(() => {
        tokenVerifier = mock<TokenVerifierInterface>();
        userCredentialsRepository = mock<UserCredentialsRepositoryInterface>();
        useCase = new ValidateTokenUseCase(tokenVerifier, userCredentialsRepository);
    });

    it('resolves the caller identity for a valid token', async () => {
        tokenVerifier.verifyToken.mockResolvedValue({ userId: 'U' });
        userCredentialsRepository.findById.mockResolvedValue({
            id: 'U',
            email: 'ada@example.com',
            passwordHash: 'hash',
        });

        const result = await useCase.invoke('a-token');

        expect(result).toEqual({ userId: 'U' });
        expect(tokenVerifier.verifyToken).toHaveBeenCalledWith('a-token');
        expect(userCredentialsRepository.findById).toHaveBeenCalledWith('U');
    });
});
