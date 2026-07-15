import { databaseClient } from '@src/modules/shared/services.js';
import { PromptCategoryFixture } from '@tests/lib/fixtures/PromptCategoryFixture.js';
import { PromptFixture } from '@tests/lib/fixtures/PromptFixture.js';
import { UserFixture } from '@tests/lib/fixtures/UserFixture.js';
import { PromptCategoryModelFactory } from '@tests/lib/modelFactories/PromptCategoryModelFactory.js';
import { PromptModelFactory } from '@tests/lib/modelFactories/PromptModelFactory.js';
import { UserModelFactory } from '@tests/lib/modelFactories/UserModelFactory.js';

// Tests reuse the app's database client so a single connect()/close() covers both
// the app-under-test and the fixtures. Connection lifecycle lives in tests/setup.ts.
export { databaseClient };
export type TestDatabaseClient = typeof databaseClient;
export type TestDatabaseConnection = ReturnType<typeof databaseClient.getConnection>;

export const promptCategoryModelFactory = new PromptCategoryModelFactory();
export const promptModelFactory = new PromptModelFactory();
export const userModelFactory = new UserModelFactory();

export const createUserFixture = (): UserFixture =>
    new UserFixture(databaseClient, userModelFactory);
export const createPromptFixture = (): PromptFixture =>
    new PromptFixture(databaseClient, promptModelFactory);
export const createPromptCategoryFixture = (): PromptCategoryFixture =>
    new PromptCategoryFixture(databaseClient, promptCategoryModelFactory);
