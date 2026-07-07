import { databaseClient, passwordHasher } from '@logic/shared/services.js';
import { RegisterUserUseCase } from '@logic/user/application/RegisterUserUseCase.js';
import { DrizzleUserRepository } from '@logic/user/infrastructure/database/DrizzleUserRepository.js';

const userRepository = new DrizzleUserRepository(databaseClient.connect());

export const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
