import { databaseClient } from '@logic/shared/services.js';
import { RegisterUserUseCase } from '@logic/user/application/RegisterUserUseCase.js';
import { BcryptPasswordHasher } from '@logic/user/infrastructure/BcryptPasswordHasher.js';
import { DrizzleUserRepository } from '@logic/user/infrastructure/database/DrizzleUserRepository.js';

const userRepository = new DrizzleUserRepository(databaseClient.connect());
const passwordHasher = new BcryptPasswordHasher();

export const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
