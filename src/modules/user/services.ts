import {
    databaseClient,
    dateTimeService,
    idGenerator,
    passwordHasher,
} from '@src/modules/shared/services.js';
import { RegisterUserUseCase } from '@src/modules/user/application/RegisterUserUseCase.js';
import { DrizzleUserRepository } from '@src/modules/user/infrastructure/database/DrizzleUserRepository.js';

const userRepository = new DrizzleUserRepository(databaseClient);

export const registerUserUseCase = new RegisterUserUseCase(
    userRepository,
    passwordHasher,
    dateTimeService,
    idGenerator,
);
