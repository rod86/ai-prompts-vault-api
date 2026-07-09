import { CreatePromptUseCase } from '@src/modules/prompt/application/CreatePromptUseCase.js';
import { DeletePromptUseCase } from '@src/modules/prompt/application/DeletePromptUseCase.js';
import { GetPromptUseCase } from '@src/modules/prompt/application/GetPromptUseCase.js';
import { ListPromptCategoriesUseCase } from '@src/modules/prompt/application/ListPromptCategoriesUseCase.js';
import { ListPromptsUseCase } from '@src/modules/prompt/application/ListPromptsUseCase.js';
import { UpdatePromptUseCase } from '@src/modules/prompt/application/UpdatePromptUseCase.js';
import { DrizzlePromptCategoryRepository } from '@src/modules/prompt/infrastructure/persistence/DrizzlePromptCategoryRepository.js';
import { DrizzlePromptRepository } from '@src/modules/prompt/infrastructure/persistence/DrizzlePromptRepository.js';
import { databaseClient, dateTimeService, idGenerator } from '@src/modules/shared/services.js';

const db = databaseClient.connect();
const promptCategoryRepository = new DrizzlePromptCategoryRepository(db);
const promptRepository = new DrizzlePromptRepository(db);

export const listPromptCategoriesUseCase = new ListPromptCategoriesUseCase(
    promptCategoryRepository,
);
export const listPromptsUseCase = new ListPromptsUseCase(promptRepository);
export const getPromptUseCase = new GetPromptUseCase(promptRepository);
export const createPromptUseCase = new CreatePromptUseCase(
    promptRepository,
    promptCategoryRepository,
    dateTimeService,
    idGenerator,
);
export const updatePromptUseCase = new UpdatePromptUseCase(
    promptRepository,
    promptCategoryRepository,
    dateTimeService,
);
export const deletePromptUseCase = new DeletePromptUseCase(promptRepository);
