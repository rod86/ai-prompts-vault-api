import { CreatePromptUseCase } from '@logic/prompt/application/CreatePromptUseCase.js';
import { DeletePromptUseCase } from '@logic/prompt/application/DeletePromptUseCase.js';
import { GetPromptUseCase } from '@logic/prompt/application/GetPromptUseCase.js';
import { ListPromptCategoriesUseCase } from '@logic/prompt/application/ListPromptCategoriesUseCase.js';
import { ListPromptsUseCase } from '@logic/prompt/application/ListPromptsUseCase.js';
import { UpdatePromptUseCase } from '@logic/prompt/application/UpdatePromptUseCase.js';
import { DrizzlePromptCategoryRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import { DrizzlePromptRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptRepository.js';
import { databaseClient } from '@logic/shared/services.js';

const promptCategoryRepository = new DrizzlePromptCategoryRepository(databaseClient.connect());
const promptRepository = new DrizzlePromptRepository(databaseClient.connect());

export const listPromptCategoriesUseCase = new ListPromptCategoriesUseCase(
    promptCategoryRepository,
);
export const listPromptsUseCase = new ListPromptsUseCase(promptRepository);
export const getPromptUseCase = new GetPromptUseCase(promptRepository);
export const createPromptUseCase = new CreatePromptUseCase(
    promptRepository,
    promptCategoryRepository,
);
export const updatePromptUseCase = new UpdatePromptUseCase(
    promptRepository,
    promptCategoryRepository,
);
export const deletePromptUseCase = new DeletePromptUseCase(promptRepository);
