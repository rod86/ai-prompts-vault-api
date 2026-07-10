import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { type DatabaseConfig } from '@src/modules/shared/domain/Database.js';
import DatabaseClient from '@src/modules/shared/infrastructure/database/DatabaseClient.js';
import { DatabaseNotConnectedError } from '@src/modules/shared/infrastructure/database/DatabaseNotConnectedError.js';

vi.mock('pg', () => ({
    Pool: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
    drizzle: vi.fn(),
}));

const CONFIG: DatabaseConfig = {
    host: 'localhost',
    port: 5432,
    user: 'user',
    password: 'secret',
    database: 'vault',
};

const SCHEMA = { prompts: {} };
const CONNECTION = { name: 'drizzle-connection' };

describe('DatabaseClient', () => {
    const PoolMock = vi.mocked(Pool);
    const drizzleMock = vi.mocked(drizzle);

    let pool: Pool;
    let client: DatabaseClient<typeof SCHEMA>;

    beforeEach(() => {
        vi.clearAllMocks();

        pool = mock<Pool>();
        PoolMock.mockImplementation(function () {
            return pool;
        } as never);
        drizzleMock.mockReturnValue(CONNECTION as never);

        client = new DatabaseClient(CONFIG, SCHEMA);
    });

    it('memoizes the connection so getConnection returns the same instance each time', () => {
        client.connect();

        const first = client.getConnection();
        const second = client.getConnection();

        expect(PoolMock).toHaveBeenCalledWith(CONFIG);
        expect(PoolMock).toHaveBeenCalledTimes(1);
        expect(drizzleMock).toHaveBeenCalledWith(pool, { schema: SCHEMA });
        expect(drizzleMock).toHaveBeenCalledTimes(1);
        expect(first).toBe(CONNECTION);
        expect(second).toBe(CONNECTION);
    });

    it('refuses to hand out a connection before establish', () => {
        expect(() => client.getConnection()).toThrow(DatabaseNotConnectedError);
        expect(PoolMock).not.toHaveBeenCalled();
    });

    it('reuses the same pool when connect is called again', () => {
        client.connect();
        client.connect();

        expect(PoolMock).toHaveBeenCalledTimes(1);
    });

    it('releases the connection on close and re-locks access', async () => {
        client.connect();
        await client.close();

        expect(pool.end).toHaveBeenCalledTimes(1);
        expect(() => client.getConnection()).toThrow(DatabaseNotConnectedError);
    });

    it('constructs a fresh pool after a close', async () => {
        client.connect();
        await client.close();
        client.connect();

        expect(PoolMock).toHaveBeenCalledTimes(2);
    });

    it('is a safe no-op when closing without an open connection', async () => {
        await expect(client.close()).resolves.toBeUndefined();
        expect(pool.end).not.toHaveBeenCalled();
    });
});
