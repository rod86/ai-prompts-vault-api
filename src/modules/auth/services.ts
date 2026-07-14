import config from '@src/config/config.js';
import { LoginUseCase } from '@src/modules/auth/application/LoginUseCase.js';
import { ValidateTokenUseCase } from '@src/modules/auth/application/ValidateTokenUseCase.js';
import { DrizzleUserCredentialsRepository } from '@src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.js';
import { JwtTokenIssuer } from '@src/modules/auth/infrastructure/security/JwtTokenIssuer.js';
import { JwtTokenVerifier } from '@src/modules/auth/infrastructure/security/JwtTokenVerifier.js';
import { databaseClient, dateTimeService, passwordHasher } from '@src/modules/shared/services.js';

const userCredentialsRepository = new DrizzleUserCredentialsRepository(databaseClient);
const tokenIssuer = new JwtTokenIssuer(config.jwtSecret);
const tokenVerifier = new JwtTokenVerifier(config.jwtSecret);

export const loginUseCase = new LoginUseCase(
    userCredentialsRepository,
    passwordHasher,
    tokenIssuer,
    dateTimeService,
    config.jwtExpirationSeconds,
);

export const validateTokenUseCase = new ValidateTokenUseCase(
    tokenVerifier,
    userCredentialsRepository,
);
