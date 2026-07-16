import { schema } from '@src/config/drizzle/index.js';
import { CreatePromptUseCase } from '@src/modules/prompt/application/CreatePromptUseCase.js';
import { DeletePromptUseCase } from '@src/modules/prompt/application/DeletePromptUseCase.js';
import { GetPromptUseCase } from '@src/modules/prompt/application/GetPromptUseCase.js';
import { ListPromptCategoriesUseCase } from '@src/modules/prompt/application/ListPromptCategoriesUseCase.js';
import { ListPromptsUseCase } from '@src/modules/prompt/application/ListPromptsUseCase.js';
import { UpdatePromptUseCase } from '@src/modules/prompt/application/UpdatePromptUseCase.js';
import { DrizzlePromptCategoryRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptCategoryRepository.js';
import { DrizzlePromptRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptRepository.js';
import { DrizzlePromptUserRepository } from '@src/modules/prompt/infrastructure/database/DrizzlePromptUserRepository.js';
import { databaseClient, dateTimeService, idGenerator } from '@src/modules/shared/services.js';

const promptCategoryRepository = new DrizzlePromptCategoryRepository(databaseClient, schema);
const promptRepository = new DrizzlePromptRepository(databaseClient, schema);
const promptUserRepository = new DrizzlePromptUserRepository(databaseClient, schema);

export const listPromptCategoriesUseCase = new ListPromptCategoriesUseCase(
    promptCategoryRepository,
);
export const listPromptsUseCase = new ListPromptsUseCase(promptRepository);
export const getPromptUseCase = new GetPromptUseCase(promptRepository);
export const createPromptUseCase = new CreatePromptUseCase(
    promptRepository,
    promptCategoryRepository,
    promptUserRepository,
    dateTimeService,
    idGenerator,
);
export const updatePromptUseCase = new UpdatePromptUseCase(
    promptRepository,
    promptCategoryRepository,
    dateTimeService,
);
export const deletePromptUseCase = new DeletePromptUseCase(promptRepository);
