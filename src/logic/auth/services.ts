import { LoginUseCase } from '@logic/auth/application/LoginUseCase.js';
import { DrizzleUserCredentialsRepository } from '@logic/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import { JwtAuthCryptoAdapter } from '@logic/auth/infrastructure/JwtAuthCryptoAdapter.js';
import { databaseClient, dateTimeService, passwordHasher } from '@logic/shared/services.js';
import config from '@src/config.js';

const userCredentialsRepository = new DrizzleUserCredentialsRepository(databaseClient.connect());
const authCrypto = new JwtAuthCryptoAdapter(config.jwtSecret, passwordHasher);

export const loginUseCase = new LoginUseCase(
    userCredentialsRepository,
    authCrypto,
    dateTimeService,
    config.jwtExpirationSeconds,
);
