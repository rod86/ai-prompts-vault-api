import { ListPromptCategoriesUseCase } from '@logic/prompt/application/ListPromptCategoriesUseCase.js';
import { DrizzlePromptCategoryRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import { databaseClient } from '@logic/shared/services.js';

const promptCategoryRepository = new DrizzlePromptCategoryRepository(databaseClient.connect());

export const listPromptCategoriesUseCase = new ListPromptCategoriesUseCase(promptCategoryRepository);
