import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { DeletePromptUseCase } from '@logic/prompt/application/DeletePromptUseCase.js';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';

const buildPrompt = (data: Partial<Prompt> = {}): Prompt => ({
    id: data.id ?? faker.string.uuid(),
    category: data.category ?? { id: faker.string.uuid(), name: faker.commerce.department() },
    title: data.title ?? faker.lorem.sentence(),
    prompt: data.prompt ?? faker.lorem.paragraph(),
    description: 'description' in data ? data.description : faker.lorem.sentence(),
    createdAt: data.createdAt ?? faker.date.past({ years: 2 }),
    updatedAt: data.updatedAt ?? faker.date.recent(),
});

describe('DeletePromptUseCase', () => {
    let promptRepository: MockProxy<PromptRepositoryInterface>;
    let useCase: DeletePromptUseCase;

    beforeEach(() => {
        promptRepository = mock<PromptRepositoryInterface>();
        useCase = new DeletePromptUseCase(promptRepository);
    });

    it('removes the prompt when it exists', async () => {
        const existingPrompt = buildPrompt();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        promptRepository.delete.mockResolvedValue(undefined);

        const result = await useCase.invoke({ id: existingPrompt.id });

        expect(result).toBeUndefined();
        expect(promptRepository.delete).toHaveBeenCalledOnce();
        expect(promptRepository.delete).toHaveBeenCalledWith(existingPrompt.id);
    });

    it('throws PromptNotFoundError and does not delete when the prompt does not exist', async () => {
        const id = faker.string.uuid();
        promptRepository.findById.mockResolvedValue(undefined);

        await expect(useCase.invoke({ id })).rejects.toThrow(PromptNotFoundError);
        await expect(useCase.invoke({ id })).rejects.toThrow(`Prompt not found: ${id}`);
        expect(promptRepository.delete).not.toHaveBeenCalled();
    });
});
