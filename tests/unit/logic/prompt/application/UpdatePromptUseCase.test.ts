import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import {
    type UpdatePromptQuery,
    UpdatePromptUseCase,
} from '@logic/prompt/application/UpdatePromptUseCase.js';
import { CategoryNotFoundError } from '@logic/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@logic/prompt/domain/errors/PromptNotFoundError.js';
import type PromptCategoryRepositoryInterface from '@logic/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@logic/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@logic/prompt/domain/Prompt.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';

const buildQuery = (data: Partial<UpdatePromptQuery> = {}): UpdatePromptQuery => ({
    id: data.id ?? faker.string.uuid(),
    title: data.title ?? faker.lorem.sentence(),
    prompt: data.prompt ?? faker.lorem.paragraph(),
    categoryId: data.categoryId ?? faker.string.uuid(),
    description: 'description' in data ? data.description : faker.lorem.sentence(),
    updatedAt: data.updatedAt ?? faker.date.recent(),
});

const buildExistingPrompt = (data: Partial<Prompt> = {}): Prompt => ({
    id: data.id ?? faker.string.uuid(),
    category: data.category ?? { id: faker.string.uuid(), name: faker.commerce.department() },
    title: data.title ?? faker.lorem.sentence(),
    prompt: data.prompt ?? faker.lorem.paragraph(),
    description: 'description' in data ? data.description : faker.lorem.sentence(),
    createdAt: data.createdAt ?? faker.date.past({ years: 2 }),
    updatedAt: data.updatedAt ?? faker.date.recent(),
});

describe('UpdatePromptUseCase', () => {
    let promptRepository: MockProxy<PromptRepositoryInterface>;
    let categoryRepository: MockProxy<PromptCategoryRepositoryInterface>;
    let useCase: UpdatePromptUseCase;

    beforeEach(() => {
        promptRepository = mock<PromptRepositoryInterface>();
        categoryRepository = mock<PromptCategoryRepositoryInterface>();
        useCase = new UpdatePromptUseCase(promptRepository, categoryRepository);
    });

    it('updates and returns the assembled prompt when the prompt and category both exist', async () => {
        const existingPrompt = buildExistingPrompt();
        const fixtureCategory = promptCategoryModelFactory.create();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.update.mockResolvedValue(undefined);
        const query = buildQuery({ id: existingPrompt.id, categoryId: fixtureCategory.id });

        const result = await useCase.invoke(query);

        expect(result).toEqual({
            id: query.id,
            category: fixtureCategory,
            title: query.title,
            prompt: query.prompt,
            description: query.description,
            createdAt: existingPrompt.createdAt,
            updatedAt: query.updatedAt,
        });
        expect(promptRepository.update).toHaveBeenCalledOnce();
        expect(promptRepository.update).toHaveBeenCalledWith(query.id, {
            categoryId: query.categoryId,
            title: query.title,
            prompt: query.prompt,
            description: query.description ?? null,
            updatedAt: query.updatedAt,
        });
    });

    it('throws PromptNotFoundError and does not look up the category or persist when the prompt does not exist', async () => {
        promptRepository.findById.mockResolvedValue(undefined);
        const query = buildQuery();

        await expect(useCase.invoke(query)).rejects.toThrow(PromptNotFoundError);
        await expect(useCase.invoke(query)).rejects.toThrow(`Prompt not found: ${query.id}`);
        expect(categoryRepository.findById).not.toHaveBeenCalled();
        expect(promptRepository.update).not.toHaveBeenCalled();
    });

    it('throws CategoryNotFoundError and does not persist when the prompt exists but the category does not', async () => {
        const existingPrompt = buildExistingPrompt();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        categoryRepository.findById.mockResolvedValue(undefined);
        const query = buildQuery({ id: existingPrompt.id });

        await expect(useCase.invoke(query)).rejects.toThrow(CategoryNotFoundError);
        await expect(useCase.invoke(query)).rejects.toThrow(
            `Category not found: ${query.categoryId}`,
        );
        expect(promptRepository.update).not.toHaveBeenCalled();
    });

    it('updates a prompt to have no description when the supplied description is absent', async () => {
        const existingPrompt = buildExistingPrompt();
        const fixtureCategory = promptCategoryModelFactory.create();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.update.mockResolvedValue(undefined);
        const query = buildQuery({
            id: existingPrompt.id,
            categoryId: fixtureCategory.id,
            description: undefined,
        });

        const result = await useCase.invoke(query);

        expect(result.description).toBeUndefined();
    });

    it('updates a prompt to have an empty-text description, distinct from no description', async () => {
        const existingPrompt = buildExistingPrompt();
        const fixtureCategory = promptCategoryModelFactory.create();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.update.mockResolvedValue(undefined);
        const query = buildQuery({
            id: existingPrompt.id,
            categoryId: fixtureCategory.id,
            description: '',
        });

        const result = await useCase.invoke(query);

        expect(result.description).toBe('');
    });
});
