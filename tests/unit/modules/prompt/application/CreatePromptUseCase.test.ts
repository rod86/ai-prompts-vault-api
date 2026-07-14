import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import {
    type CreatePromptQuery,
    CreatePromptUseCase,
} from '@src/modules/prompt/application/CreatePromptUseCase.js';
import { CategoryNotFoundError } from '@src/modules/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptCreationError } from '@src/modules/prompt/domain/errors/PromptCreationError.js';
import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import type IdGeneratorInterface from '@src/modules/shared/domain/interfaces/IdGeneratorInterface.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';

const buildQuery = (data: Partial<CreatePromptQuery> = {}): CreatePromptQuery => ({
    title: data.title ?? faker.lorem.sentence(),
    prompt: data.prompt ?? faker.lorem.paragraph(),
    categoryId: data.categoryId ?? faker.string.uuid(),
    userId: data.userId ?? faker.string.uuid(),
    description: 'description' in data ? data.description : faker.lorem.sentence(),
});

describe('CreatePromptUseCase', () => {
    let promptRepository: MockProxy<PromptRepositoryInterface>;
    let categoryRepository: MockProxy<PromptCategoryRepositoryInterface>;
    let dateTime: MockProxy<DateTimeInterface>;
    let idGenerator: MockProxy<IdGeneratorInterface>;
    let useCase: CreatePromptUseCase;
    const generatedId = faker.string.uuid();
    const now = faker.date.recent();

    beforeEach(() => {
        promptRepository = mock<PromptRepositoryInterface>();
        categoryRepository = mock<PromptCategoryRepositoryInterface>();
        dateTime = mock<DateTimeInterface>();
        idGenerator = mock<IdGeneratorInterface>();
        dateTime.now.mockReturnValue(now);
        idGenerator.generate.mockReturnValue(generatedId);
        useCase = new CreatePromptUseCase(promptRepository, categoryRepository, dateTime, idGenerator);
    });

    it('creates the prompt with the caller as creator and returns the re-read prompt', async () => {
        const fixtureCategory = promptCategoryModelFactory.create();
        const query = buildQuery({ categoryId: fixtureCategory.id });
        const resolvedPrompt: Prompt = {
            id: generatedId,
            category: fixtureCategory,
            user: { id: query.userId, name: faker.person.fullName() },
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: now,
            updatedAt: now,
        };
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.create.mockResolvedValue(undefined);
        promptRepository.findById.mockResolvedValue(resolvedPrompt);

        const result = await useCase.invoke(query);

        expect(result).toEqual(resolvedPrompt);
        expect(promptRepository.create).toHaveBeenCalledOnce();
        expect(promptRepository.create).toHaveBeenCalledWith({
            id: generatedId,
            categoryId: fixtureCategory.id,
            userId: query.userId,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: now,
            updatedAt: now,
        });
        expect(promptRepository.findById).toHaveBeenCalledWith(generatedId);
        expect(dateTime.now).toHaveBeenCalledOnce();
    });

    it('throws CategoryNotFoundError and does not persist when the category does not exist', async () => {
        categoryRepository.findById.mockResolvedValue(undefined);
        const query = buildQuery();

        await expect(useCase.invoke(query)).rejects.toThrow(CategoryNotFoundError);
        await expect(useCase.invoke(query)).rejects.toThrow(`Category not found: ${query.categoryId}`);
        expect(promptRepository.create).not.toHaveBeenCalled();
    });

    it('creates a prompt with no description unchanged', async () => {
        const fixtureCategory = promptCategoryModelFactory.create();
        const query = buildQuery({ categoryId: fixtureCategory.id, description: undefined });
        const resolvedPrompt: Prompt = {
            id: generatedId,
            category: fixtureCategory,
            user: { id: query.userId, name: faker.person.fullName() },
            title: query.title,
            prompt: query.prompt,
            description: undefined,
            createdAt: now,
            updatedAt: now,
        };
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.create.mockResolvedValue(undefined);
        promptRepository.findById.mockResolvedValue(resolvedPrompt);

        const result = await useCase.invoke(query);

        expect(result.description).toBeUndefined();
    });

    it('throws PromptCreationError wrapping the original error when the repository rejects while creating', async () => {
        const fixtureCategory = promptCategoryModelFactory.create();
        const fixtureError = new Error('connection lost');
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.create.mockRejectedValue(fixtureError);
        const query = buildQuery({ categoryId: fixtureCategory.id });

        const error: unknown = await useCase.invoke(query).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(PromptCreationError);
        expect((error as PromptCreationError).cause).toBe(fixtureError);
    });
});
