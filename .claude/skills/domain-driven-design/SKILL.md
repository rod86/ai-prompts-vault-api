---
name: domain-driven-design
description: Domain-Driven Design guidelines for TypeScript backends — how to organize business logic into bounded contexts with domain, application, and infrastructure layers, and the exact format for entities, use cases, repository interfaces, domain errors, and adapters. Use whenever writing or reviewing business logic, creating an entity, use case, repository, or domain error, structuring a new TypeScript backend or feature, or when the user mentions DDD, domain model, use cases, layers, or bounded contexts — even if they don't say "DDD" explicitly.
---

# DDD Guidelines

Organize business logic by Domain-Driven Design: bounded contexts, each split into three layers. Keep the domain pure, the application thin, and the libraries at the edge.

## Structure

One folder per bounded context (a business area: `user`, `order`, `billing`), each with the same three layers plus a wiring file:

```
src/modules/
  <context>/               # e.g. order/
    domain/                # entities + entity data shapes
      interfaces/          # contracts implemented by infrastructure
      errors/              # business errors
    application/           # use cases
    infrastructure/        # adapters, grouped in subfolders (persistence/, providerApi/, ...)
    services.ts              # wires infrastructure into use cases
  shared/                  # code used by 2+ contexts; imports from no context
    domain/interfaces/     # cross-cutting ports: DateTimeInterface, IdGeneratorInterface, ...
    infrastructure/         # their adapters, grouped in subfolders (datetime/, identity/, database/, ...)
```

**Non-determinism is a port, not a call.** Time, random IDs, and env/config reads are impure — the domain and application layers never call `new Date()`, `Date.now()`, `randomUUID()`, or `process.env` directly. Each becomes a small interface (`DateTimeInterface.now()`, `IdGeneratorInterface.generate()`, `ConfigInterface.get(key)`), injected into the use case constructor like any other dependency, and produced inside `invoke()` when the business logic needs it — not passed in from the edge. Because these ports are used by many contexts, they live in `shared/domain/interfaces/` with their adapters in `shared/infrastructure/`, and every context's `services.ts` wires the same shared instance in. This is what makes use cases deterministic in tests: swap in a `FixedDateTime` and a `FixedIdGenerator` instead of mocking globals or freezing the system clock.

**Dependency rule** — imports point inward only: `infrastructure → application → domain`. The domain imports nothing from the other layers; the application never imports infrastructure. If code used by one context sits in `shared/`, move it into that context.

**At a glance:**

| Thing | Convention | Location |
| --- | --- | --- |
| Entity | `export type <Name> = { ... }`, file `<Name>.ts`, native types only | `<context>/domain/` |
| Entity data shape | `export type <Name>Filter` / `Update<Name>` in the entity's file | `<context>/domain/` |
| Port / contract | `interface <Domain><Role>Interface` — `<Role>` = the port's purpose (Repository, Provider, Gateway, Hasher, …), never a technology; default export | `<context>/domain/interfaces/` |
| Domain error | `class <What>Error extends Error`, sets `this.name` | `<context>/domain/errors/` |
| Use case | `class <Name>UseCase`, filename = class, single `invoke(query?)` | `<context>/application/` |
| Use case input | `<Name>Query` — optional; when present it's an object of native types (never raw params); omit entirely when the use case takes no input | same file as the use case |
| Use case output | `<Name>Response` — the return shape, never a domain entity; omit it and return `void` when not needed | same file as the use case |
| Adapter | `class <Technology><Contract>` implementing a domain port | `<context>/infrastructure/<subfolder>/` — same rule for `shared/infrastructure/<subfolder>/` |
| Wiring | `services.ts` exports instantiated use cases; sole entry point for outside code | `<context>/services.ts` |

Port names describe their role, not their technology: `OrderRepositoryInterface` (persistence), `PaymentTransactionProviderInterface` (external provider).

## Domain layer (`<context>/domain/`)

Entities are plain TypeScript types — one per file, file named after the entity, native types only (`string`, `number`, `Date`). Data shapes that belong to an entity (filters, partial-update types) live in the entity's file, not in `interfaces/`:

```typescript
// domain/Order.ts
export type Order = {
    id: string;
    customerName: string;
    total: number;
    createdAt: Date;
    updatedAt: Date;
};

export type OrderFilter = {
    customerName?: string;
};

export type UpdateOrder = {
    customerName?: string;
    total?: number;
    updatedAt: Date;
};
```

**`domain/interfaces/`** holds only contracts the inner layers depend on — the ports that infrastructure will implement. Name them `<Domain><Role>Interface`, where `<Role>` describes the kind of port (`Repository` for persistence, `Provider`/`Gateway` for external systems, `Hasher`, `Clock`, …) — never the technology (no `Drizzle`, `Postgres`, `Aws`; the domain must not know what implements it). Examples: `OrderRepositoryInterface`, `PaymentTransactionProviderInterface`. Default-export them, model absence as `undefined`, and never throw from the contract:

```typescript
// domain/interfaces/OrderRepositoryInterface.ts
import { type Order, type OrderFilter, type UpdateOrder } from '../Order.js';

export default interface OrderRepositoryInterface {
    findAll(filter?: OrderFilter): Promise<Order[]>;
    findById(id: string): Promise<Order | undefined>;
    create(order: Order): Promise<void>;
    update(id: string, order: UpdateOrder): Promise<void>;
    delete(id: string): Promise<void>;
}
```

**`domain/errors/`** — one class per file, named in business language (`OrderNotFoundError`, `EmailAlreadyInUseError` — what went wrong, not where), extending `Error` and setting `this.name` so it survives serialization:

```typescript
// domain/errors/OrderNotFoundError.ts
export class OrderNotFoundError extends Error {
    constructor(id: string) {
        super(`Order not found: ${id}`);
        this.name = 'OrderNotFoundError';
    }
}
```

## Application layer (`<context>/application/`)

One use case per meaningful business operation. Each file is self-contained and named after its class: the input `Query` interface, an optional `Response` interface, and the use case class.

```typescript
// application/CreateOrderUseCase.ts
import { OrderTotalTooLowError } from '../domain/errors/OrderTotalTooLowError.js';
import type OrderRepositoryInterface from '../domain/interfaces/OrderRepositoryInterface.js';
import type DateTimeInterface from '../../shared/domain/interfaces/DateTimeInterface.js';
import type IdGeneratorInterface from '../../shared/domain/interfaces/IdGeneratorInterface.js';
import { type Order } from '../domain/Order.js';

export interface CreateOrderQuery {
    customerName: string;
    total: number;
}

export interface CreateOrderResponse {
    id: string;
    customerName: string;
    total: number;
    createdAt: Date;
}

export class CreateOrderUseCase {
    constructor(
        private readonly orderRepository: OrderRepositoryInterface,
        private readonly dateTime: DateTimeInterface,
        private readonly idGenerator: IdGeneratorInterface,
    ) {}

    public async invoke(query: CreateOrderQuery): Promise<CreateOrderResponse> {
        if (query.total <= 0) {
            throw new OrderTotalTooLowError(query.customerName);
        }

        const now = this.dateTime.now();
        const order: Order = {
            id: this.idGenerator.generate(),
            customerName: query.customerName,
            total: query.total,
            createdAt: now,
            updatedAt: now,
        };
        await this.orderRepository.create(order);

        // Map the domain entity to a custom Response — never return the entity itself.
        return {
            id: order.id,
            customerName: order.customerName,
            total: order.total,
            createdAt: order.createdAt,
        };
    }
}
```

Rules:

- Class suffixed `UseCase`; filename equals class name; single public method `invoke(query)`.
- A use case that needs input takes exactly one `<Name>Query` object of native types — never raw parameters, even for a single field (this keeps call sites stable when fields are added). A use case that needs no input omits the `Query` type and takes no argument (`invoke()`).
- Declare a `<Name>Response` interface for the return shape; when not needed, omit it and return `void`.
- Never return a domain entity from a use case — define and return a custom `<Name>Response` type instead. Returning the entity couples callers and the API to an internal domain shape.
- Dependencies arrive through the constructor as `private readonly` domain interfaces.
- The use case orchestrates: check existence, enforce business rules, throw domain errors, call repositories. No framework or library imports — if you need the database or crypto, depend on a domain interface for it.
- Never call `new Date()`, `Date.now()`, `randomUUID()`, or read `process.env` inside a use case or entity. Depend on `DateTimeInterface` / `IdGeneratorInterface` / `ConfigInterface` (injected via the constructor, same as a repository) and call them inside `invoke()` instead. IDs and timestamps are generated by the business logic, not received from the edge.

## Infrastructure layer (`<context>/infrastructure/`)

The only layer where third-party libraries appear (ORM, crypto, HTTP clients). Each class implements a domain interface and is named `<Technology><Contract>`: `DrizzleOrderRepository`, `BcryptPasswordHasher`, `JwtAuthCryptoAdapter`. This has no exceptions — even a low-level client/connection wrapper (e.g. a database connection provider) implements a domain interface; there is no category of adapter exempt from this.

**No class file sits directly under `infrastructure/`.** Every adapter goes in a subfolder named for its kind (`persistence/` for DB repositories plus their schema definitions, `providerApi/` for external HTTP clients, `datetime/`, `database/`, `security/`, ...) — this applies identically to a context's own `infrastructure/` and to `shared/infrastructure/`, with no exception for single-file adapters. If the right grouping name isn't obvious, don't guess silently: ask the user, or propose 2–3 candidate names for them to pick from.

Repositories translate between persistence rows and domain entities — the mapping (including `null` → `undefined`) happens here so the domain never sees storage shapes. A repository receives the shared `DatabaseClientInterface` port itself (not a bare connection) and pulls both the query connection and its table objects from it, once, in the constructor. The co-located `schema.ts` may still be imported, but only for its **types** (to parameterize the generic) — never for the runtime table-object values:

```typescript
// infrastructure/persistence/schema.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
    /* ... */
});

export type OrderSchema = { orders: typeof orders };
```

```typescript
// infrastructure/persistence/DrizzleOrderRepository.ts
import { eq } from 'drizzle-orm';
import type DatabaseClientInterface, {
    type DatabaseConnection,
} from '../../../shared/domain/interfaces/DatabaseClientInterface.js';
import type OrderRepositoryInterface from '../../domain/interfaces/OrderRepositoryInterface.js';
import { type Order } from '../../domain/Order.js';
import { type OrderSchema } from './schema.js';

export class DrizzleOrderRepository implements OrderRepositoryInterface {
    private readonly db: DatabaseConnection<OrderSchema>;
    private readonly orders: OrderSchema['orders'];

    constructor(client: DatabaseClientInterface<OrderSchema>) {
        this.db = client.connect();
        this.orders = client.schema().orders;
    }

    public async findById(id: string): Promise<Order | undefined> {
        const rows = await this.db.select().from(this.orders).where(eq(this.orders.id, id)).limit(1);
        const row = rows[0];

        if (!row) {
            return undefined;
        }

        return {
            id: row.id,
            customerName: row.customerName,
            total: row.total,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    // create/update/delete follow the same pattern
}
```

## Shared cross-cutting ports (`shared/domain/interfaces/`)

Time, randomness, and low-level infrastructure clients (a database connection provider, an
HTTP client wrapper, …) are dependencies like any other — model them as ports in `shared/`,
implemented once, and injected into every context that needs them. This applies without
exception, even to a class that just wraps a driver/pool and exposes `connect`/`close`: it
still implements a domain interface, exactly like a repository does.

```typescript
// shared/domain/interfaces/DateTimeInterface.ts
export default interface DateTimeInterface {
    now(): Date;
}
```

```typescript
// shared/domain/interfaces/IdGeneratorInterface.ts
export default interface IdGeneratorInterface {
    generate(): string;
}
```

```typescript
// shared/domain/interfaces/DatabaseClientInterface.ts
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';

// The connection shape is part of the port's contract (connect()'s return type), not an
// implementation detail, so it lives here in domain/ alongside the interface — not in
// infrastructure/.
export type DatabaseConnection<DatabaseSchema extends Record<string, unknown> = Record<string, unknown>> =
    NodePgDatabase<DatabaseSchema>;

export default interface DatabaseClientInterface<DatabaseSchema extends Record<string, unknown>> {
    connect(): DatabaseConnection<DatabaseSchema>;
    schema(): DatabaseSchema;
    close(): Promise<void>;
}
```

```typescript
// shared/infrastructure/datetime/SystemDateTime.ts
import type DateTimeInterface from '../../domain/interfaces/DateTimeInterface.js';

export class SystemDateTime implements DateTimeInterface {
    public now(): Date {
        return new Date();
    }
}
```

```typescript
// shared/infrastructure/identity/UuidGenerator.ts
import { randomUUID } from 'node:crypto';
import type IdGeneratorInterface from '../../domain/interfaces/IdGeneratorInterface.js';

export class UuidGenerator implements IdGeneratorInterface {
    public generate(): string {
        return randomUUID();
    }
}
```

```typescript
// shared/infrastructure/database/DatabaseClient.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type DatabaseClientInterface, { type DatabaseConnection } from '../../domain/interfaces/DatabaseClientInterface.js';

export type DatabaseConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export class DatabaseClient<DatabaseSchema extends Record<string, unknown>>
    implements DatabaseClientInterface<DatabaseSchema>
{
    private pool: Pool | undefined;

    constructor(
        private readonly config: DatabaseConfig,
        private readonly databaseSchema: DatabaseSchema,
    ) {}

    public connect(): DatabaseConnection<DatabaseSchema> {
        if (this.pool === undefined) {
            this.pool = new Pool(this.config);
        }

        return drizzle(this.pool, { schema: this.databaseSchema });
    }

    public schema(): DatabaseSchema {
        return this.databaseSchema;
    }

    public async close(): Promise<void> {
        if (this.pool === undefined) {
            return;
        }

        await this.pool.end();
        this.pool = undefined;
    }
}
```

`shared/services.ts` instantiates these adapters once and exports the singletons every context's `services.ts` wires in:

```typescript
// shared/services.ts
import { SystemDateTime } from './infrastructure/datetime/SystemDateTime.js';
import { UuidGenerator } from './infrastructure/identity/UuidGenerator.js';
import { DatabaseClient } from './infrastructure/database/DatabaseClient.js';

export const systemDateTime = new SystemDateTime();
export const uuidGenerator = new UuidGenerator();
export const databaseClient = new DatabaseClient();
```

In tests, swap these for a `FixedDateTime` / `FixedIdGenerator` that return constant values — no mocking `Date` or `crypto` globals, and use cases stay fully deterministic.

## Wiring (`<context>/services.ts`)

Each context wires its own pieces: instantiate the infrastructure implementations, inject them into use cases, and export the ready-to-call use cases. Code outside the context (HTTP handlers, CLI commands) imports only from `services.ts` — never a use case, repository, or schema directly:

```typescript
// order/services.ts
import { CreateOrderUseCase } from './application/CreateOrderUseCase.js';
import { GetOrderUseCase } from './application/GetOrderUseCase.js';
import { DrizzleOrderRepository } from './infrastructure/persistence/DrizzleOrderRepository.js';
import { databaseClient, systemDateTime, uuidGenerator } from '../shared/services.js';

const orderRepository = new DrizzleOrderRepository(databaseClient);

export const createOrderUseCase = new CreateOrderUseCase(orderRepository, systemDateTime, uuidGenerator);
export const getOrderUseCase = new GetOrderUseCase(orderRepository);
```

## Testing

The architecture buys you two kinds of tests, plus what's left uncovered on purpose. Pure unit tests concentrate at the use-case layer; integration tests are reserved for adapters at the edge. The domain layer is never tested on its own.

- **Use case → unit test.** Instantiate the use case with **mocks** of the domain ports, plus the fixed shared ports (`FixedDateTime`, `FixedIdGenerator`). Assert on the returned `Response` and on the mocks' interactions, and cover each domain-error branch. Fast, deterministic, no I/O and no mocking of globals — this is where the bulk of the business logic, and the domain errors it throws, gets verified.
- **Infrastructure adapter → integration test.** Test against the **real** dependency (real DB, real HTTP client), never a mock — a mocked dependency proves nothing. What's under test is the mapping (row ↔ entity, `null → undefined`) and that the port contract holds against the real technology. How you provision that dependency is up to your setup.
- **Composed adapters (an adapter with other adapters injected) → still integration.** The injection graph doesn't decide the test type — what sits at the bottom of it does. If the class's value comes from touching real technology (directly or through an injected adapter that wraps it), test it end-to-end against the real dependency. Mocking the injected port would erase the very thing the adapter exists to do. Smell to watch for: an "adapter" with real branching logic that depends *only* on other domain ports (no real technology of its own) is application logic in disguise — move it into a use case, where it gets a proper unit test with port mocks, and leave the thin adapters to integration tests.
- **Domain (types, interfaces, errors) → no dedicated tests.** It has no logic of its own, so it's covered indirectly: interfaces by the port mocks and real adapters above, errors by the use-case error-branch assertions, plain types by nothing.
- **Wiring (`services.ts`) → no dedicated tests.** It has no logic of its own either — pure composition, instantiating and exporting singletons/use cases. Covered indirectly: `tsc` proves the exports are shaped correctly, and the unit/integration tests of what it wires (use cases, adapters) prove those pieces work. See `testing-practices` for the general "no logic, no test" rule this follows.

| Component | Test type | Strategy |
| --- | --- | --- |
| Use case | Unit test | Mock ports, fixed shared dependencies, verify responses and interactions |
| Infrastructure adapter | Integration test | Use real dependencies, verify mappings and contracts |
| Domain (types / interfaces / errors) | — | No dedicated tests; covered through the use-case and adapter tests above |
| Wiring (`services.ts`) | — | No dedicated tests; covered by `tsc` + the tests of what it wires |
