import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import {
    type UpdatePromptQuery,
    UpdatePromptUseCase,
} from '@src/modules/prompt/application/UpdatePromptUseCase.js';
import { CategoryNotFoundError } from '@src/modules/prompt/domain/errors/CategoryNotFoundError.js';
import { PromptNotFoundError } from '@src/modules/prompt/domain/errors/PromptNotFoundError.js';
import { PromptUpdateError } from '@src/modules/prompt/domain/errors/PromptUpdateError.js';
import type PromptCategoryRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptCategoryRepositoryInterface.js';
import type PromptRepositoryInterface from '@src/modules/prompt/domain/interfaces/PromptRepositoryInterface.js';
import { type Prompt } from '@src/modules/prompt/domain/Prompt.js';
import type DateTimeInterface from '@src/modules/shared/domain/interfaces/DateTimeInterface.js';
import { promptCategoryModelFactory } from '@tests/lib/config.js';

const buildQuery = (data: Partial<UpdatePromptQuery> = {}): UpdatePromptQuery => ({
    id: data.id ?? faker.string.uuid(),
    title: data.title ?? faker.lorem.sentence(),
    prompt: data.prompt ?? faker.lorem.paragraph(),
    categoryId: data.categoryId ?? faker.string.uuid(),
    description: 'description' in data ? data.description : faker.lorem.sentence(),
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
    let dateTime: MockProxy<DateTimeInterface>;
    let useCase: UpdatePromptUseCase;
    const now = faker.date.recent();

    beforeEach(() => {
        promptRepository = mock<PromptRepositoryInterface>();
        categoryRepository = mock<PromptCategoryRepositoryInterface>();
        dateTime = mock<DateTimeInterface>();
        dateTime.now.mockReturnValue(now);
        useCase = new UpdatePromptUseCase(promptRepository, categoryRepository, dateTime);
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
            updatedAt: now,
        });
        expect(promptRepository.update).toHaveBeenCalledOnce();
        expect(promptRepository.update).toHaveBeenCalledWith(query.id, {
            categoryId: query.categoryId,
            title: query.title,
            prompt: query.prompt,
            description: query.description ?? null,
            updatedAt: now,
        });
        expect(dateTime.now).toHaveBeenCalledOnce();
    });

    it('throws PromptNotFoundError and does not look up the category, persist, or read the clock when the prompt does not exist', async () => {
        promptRepository.findById.mockResolvedValue(undefined);
        const query = buildQuery();

        await expect(useCase.invoke(query)).rejects.toThrow(PromptNotFoundError);
        await expect(useCase.invoke(query)).rejects.toThrow(`Prompt not found: ${query.id}`);
        expect(categoryRepository.findById).not.toHaveBeenCalled();
        expect(promptRepository.update).not.toHaveBeenCalled();
        expect(dateTime.now).not.toHaveBeenCalled();
    });

    it('throws CategoryNotFoundError and does not persist or read the clock when the prompt exists but the category does not', async () => {
        const existingPrompt = buildExistingPrompt();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        categoryRepository.findById.mockResolvedValue(undefined);
        const query = buildQuery({ id: existingPrompt.id });

        await expect(useCase.invoke(query)).rejects.toThrow(CategoryNotFoundError);
        await expect(useCase.invoke(query)).rejects.toThrow(
            `Category not found: ${query.categoryId}`,
        );
        expect(promptRepository.update).not.toHaveBeenCalled();
        expect(dateTime.now).not.toHaveBeenCalled();
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

    it('does not look up the category and reuses the existing one when the requested category id is unchanged', async () => {
        const existingPrompt = buildExistingPrompt();
        promptRepository.findById.mockResolvedValue(existingPrompt);
        promptRepository.update.mockResolvedValue(undefined);
        const query = buildQuery({ id: existingPrompt.id, categoryId: existingPrompt.category.id });

        const result = await useCase.invoke(query);

        expect(categoryRepository.findById).not.toHaveBeenCalled();
        expect(result.category).toEqual(existingPrompt.category);
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

    it('throws PromptUpdateError wrapping the original error when the repository rejects while updating', async () => {
        const existingPrompt = buildExistingPrompt();
        const fixtureCategory = promptCategoryModelFactory.create();
        const fixtureError = new Error('connection lost');
        promptRepository.findById.mockResolvedValue(existingPrompt);
        categoryRepository.findById.mockResolvedValue(fixtureCategory);
        promptRepository.update.mockRejectedValue(fixtureError);
        const query = buildQuery({ id: existingPrompt.id, categoryId: fixtureCategory.id });

        const error: unknown = await useCase.invoke(query).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(PromptUpdateError);
        expect((error as PromptUpdateError).cause).toBe(fixtureError);
    });
});
