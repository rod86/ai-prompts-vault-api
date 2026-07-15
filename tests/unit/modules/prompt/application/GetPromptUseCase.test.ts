import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { GetPromptUseCase } from '@src/modules/prompt/application/GetPromptUseCase.js';
import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';
import { promptModelFactory, promptCategoryModelFactory } from '@tests/lib/config.js';

const buildPrompt = (data: Partial<Prompt> = {}): Prompt => {
    const { categoryId: _categoryId, userId: _userId, ...prompt } = promptModelFactory.create(data);
    return {
        ...prompt,
        category: promptCategoryModelFactory.create(),
        user: { id: faker.string.uuid(), name: faker.person.fullName() },
    };
};

describe('GetPromptUseCase', () => {
    let repository: MockProxy<PromptRepositoryInterface>;
    let useCase: GetPromptUseCase;

    beforeEach(() => {
        repository = mock<PromptRepositoryInterface>();
        useCase = new GetPromptUseCase(repository);
    });

    it('returns the prompt provided by the repository', async () => {
        const fixture = buildPrompt();
        repository.findById.mockResolvedValue(fixture);

        const result = await useCase.invoke({ id: fixture.id });

        expect(result).toEqual(fixture);
    });

    it('throws PromptNotFoundError when the repository finds nothing', async () => {
        repository.findById.mockResolvedValue(undefined);

        await expect(useCase.invoke({ id: 'missing-id' })).rejects.toThrow(PromptNotFoundError);
        await expect(useCase.invoke({ id: 'missing-id' })).rejects.toThrow('Prompt not found: missing-id');
    });

    it('returns a prompt with no description unchanged', async () => {
        const { description: _description, ...rest } = buildPrompt();
        const fixture: Prompt = rest;
        repository.findById.mockResolvedValue(fixture);

        const result = await useCase.invoke({ id: fixture.id });

        expect(result.description).toBeUndefined();
    });
});
