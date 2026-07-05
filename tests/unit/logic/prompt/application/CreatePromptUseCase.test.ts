import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import {
    type CreatePromptQuery,
    CreatePromptUseCase,
} from '@logic/prompt/application/CreatePromptUseCase.js';
import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';

const buildQuery = (data: Partial<CreatePromptQuery> = {}): CreatePromptQuery => ({
    id: data.id ?? faker.string.uuid(),
    title: data.title ?? faker.lorem.sentence(),
    prompt: data.prompt ?? faker.lorem.paragraph(),
    categoryId: data.categoryId ?? faker.string.uuid(),
    description: 'description' in data ? data.description : faker.lorem.sentence(),
    createdAt: data.createdAt ?? faker.date.recent(),
    updatedAt: data.updatedAt ?? faker.date.recent(),
});

describe('CreatePromptUseCase', () => {
    let promptRepository: MockProxy<PromptRepositoryInterface>;
    let categoryRepository: MockProxy<PromptCategoryRepositoryInterface>;
    let useCase: CreatePromptUseCase;

    beforeEach(() => {
        promptRepository = mock<PromptRepositoryInterface>();
        categoryRepository = mock<PromptCategoryRepositoryInterface>();
        useCase = new CreatePromptUseCase(promptRepository, categoryRepository);
    });

    it('creates and returns the assembled prompt when the category exists', async () => {
        const fixtureCategory = promptCategoryModelFactory.create();
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.create.mockResolvedValue(undefined);
        const query = buildQuery({ categoryId: fixtureCategory.id });

        const result = await useCase.invoke(query);

        const expected = {
            id: query.id,
            category: fixtureCategory,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt,
        };
        expect(result).toEqual(expected);
        expect(promptRepository.create).toHaveBeenCalledOnce();
        expect(promptRepository.create).toHaveBeenCalledWith(expected);
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
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.create.mockResolvedValue(undefined);
        const query = buildQuery({ categoryId: fixtureCategory.id, description: undefined });

        const result = await useCase.invoke(query);

        expect(result.description).toBeUndefined();
    });
});
