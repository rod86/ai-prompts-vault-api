import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ValidateTokenUseCase } from '@src/modules/auth/application/ValidateTokenUseCase.js';
import type TokenVerifierInterface from '@src/modules/auth/domain/interfaces/TokenVerifierInterface.js';

describe('ValidateTokenUseCase', () => {
    let tokenVerifier: MockProxy<TokenVerifierInterface>;
    let useCase: ValidateTokenUseCase;

    beforeEach(() => {
        tokenVerifier = mock<TokenVerifierInterface>();
        useCase = new ValidateTokenUseCase(tokenVerifier);
    });

    it('resolves the caller identity for a valid token', async () => {
        tokenVerifier.verifyToken.mockResolvedValue({ userId: 'U' });

        const result = await useCase.invoke('a-token');

        expect(result).toEqual({ userId: 'U' });
        expect(tokenVerifier.verifyToken).toHaveBeenCalledWith('a-token');
    });
});
