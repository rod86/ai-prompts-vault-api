import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DatabaseClient, { type DatabaseConfig } from '@logic/shared/database/DatabaseClient.js';

vi.mock('pg', () => ({
    Pool: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
    drizzle: vi.fn(),
}));

describe('DatabaseClient', () => {
    const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        user: 'user',
        password: 'secret',
        database: 'vault',
    };

    const PoolMock = vi.mocked(Pool);
    const drizzleMock = vi.mocked(drizzle);

    beforeEach(() => {
        vi.clearAllMocks();
        PoolMock.mockImplementation(function () {
            return { end: vi.fn().mockResolvedValue(undefined) };
        } as never);
    });

    it('opens the connection bound to the provided schema', () => {
        const schema = { prompts: {} };
        const pool = { end: vi.fn() };
        const connection = { name: 'drizzle-connection' };
        PoolMock.mockImplementation(function () {
            return pool;
        } as never);
        drizzleMock.mockReturnValue(connection as never);

        const client = new DatabaseClient(schema, config);
        const result = client.connect();

        expect(PoolMock).toHaveBeenCalledWith(config);
        expect(drizzleMock).toHaveBeenCalledWith(pool, { schema });
        expect(result).toBe(connection);
    });

    it('reuses the same pool when connect is called again', () => {
        const client = new DatabaseClient({ prompts: {} }, config);

        client.connect();
        client.connect();

        expect(PoolMock).toHaveBeenCalledTimes(1);
    });

    it('releases the connection on close', async () => {
        const end = vi.fn().mockResolvedValue(undefined);
        PoolMock.mockImplementation(function () {
            return { end };
        } as never);
        const client = new DatabaseClient({ prompts: {} }, config);

        client.connect();
        await client.close();

        expect(end).toHaveBeenCalledTimes(1);
    });

    it('constructs a fresh pool after a close', async () => {
        const client = new DatabaseClient({ prompts: {} }, config);

        client.connect();
        await client.close();
        client.connect();

        expect(PoolMock).toHaveBeenCalledTimes(2);
    });

    it('is a safe no-op when closing without an open connection', async () => {
        const end = vi.fn();
        PoolMock.mockImplementation(function () {
            return { end };
        } as never);
        const client = new DatabaseClient({ prompts: {} }, config);

        await expect(client.close()).resolves.toBeUndefined();
        expect(end).not.toHaveBeenCalled();
    });
});
