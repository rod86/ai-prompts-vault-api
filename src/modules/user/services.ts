import { schema } from '@src/config/drizzle/index.js';
import {
    databaseClient,
    dateTimeService,
    idGenerator,
    passwordHasher,
    passwordStrengthChecker,
} from '@src/modules/shared/services.js';
import { RegisterUserUseCase } from '@src/modules/user/application/RegisterUserUseCase.js';
import { DrizzleUserRepository } from '@src/modules/user/infrastructure/database/DrizzleUserRepository.js';

const userRepository = new DrizzleUserRepository(databaseClient, schema);

export const registerUserUseCase = new RegisterUserUseCase(
    userRepository,
    passwordHasher,
    dateTimeService,
    idGenerator,
    passwordStrengthChecker,
);
