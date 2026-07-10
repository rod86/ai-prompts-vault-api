import config from '@src/config.js';
import { LoginUseCase } from '@src/modules/auth/application/LoginUseCase.js';
import { DrizzleUserCredentialsRepository } from '@src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import { JwtTokenIssuer } from '@src/modules/auth/infrastructure/security/JwtTokenIssuer.js';
import { databaseClient, dateTimeService, passwordHasher } from '@src/modules/shared/services.js';

const userCredentialsRepository = new DrizzleUserCredentialsRepository(databaseClient);
const tokenIssuer = new JwtTokenIssuer(config.jwtSecret);

export const loginUseCase = new LoginUseCase(
    userCredentialsRepository,
    passwordHasher,
    tokenIssuer,
    dateTimeService,
    config.jwtExpirationSeconds,
);
