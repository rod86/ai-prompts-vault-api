import { type TestDatabaseClient, type TestDatabaseConnection } from '@tests/lib/config.js';

type Identifiable = { id: string };

export abstract class AbstractFixture<TModel extends Identifiable> {
    protected readonly ids = new Set<string>();

    constructor(private readonly databaseClient: TestDatabaseClient) {}

    /** Resolved lazily per operation, so fixtures can be built before connect(). */
    protected get db(): TestDatabaseConnection {
        return this.databaseClient.getConnection();
    }

    public abstract insert(data?: Partial<TModel>): Promise<TModel>;

    public abstract cleanup(): Promise<void>;

    /** Track an externally-created id (e.g. a row the app inserted) for cleanup. */
    public register(id: string): void {
        this.ids.add(id);
    }
}
