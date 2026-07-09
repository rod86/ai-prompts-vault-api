import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '@src/modules/shared/infrastructure/BcryptPasswordHasher.js';
import DatabaseClient from '@src/modules/shared/infrastructure/DatabaseClient.js';
import { DateTimeService } from '@src/modules/shared/infrastructure/DateTimeService.js';
import { databaseClient, dateTimeService, passwordHasher } from '@src/modules/shared/services.js';

describe('shared services.ts', () => {
    it('exposes a ready-to-use DateTimeService instance', () => {
        expect(dateTimeService).toBeInstanceOf(DateTimeService);
    });

    it('exposes a ready-to-use BcryptPasswordHasher instance', () => {
        expect(passwordHasher).toBeInstanceOf(BcryptPasswordHasher);
    });

    it('exposes a ready-to-use DatabaseClient instance', () => {
        expect(databaseClient).toBeInstanceOf(DatabaseClient);
    });
});
