import { afterAll, beforeAll } from 'vitest';
import { databaseClient } from '@tests/lib/config.js';

// Wired into the `integration` project only (see vitest.config.ts), so unit runs
// never touch the DB. Runs per integration file (Vitest isolates each file); fixtures
// and the app-under-test share this one client, so a single connect()/close() suffices.
beforeAll(() => {
    databaseClient.connect();
});

afterAll(async () => {
    await databaseClient.close();
});
