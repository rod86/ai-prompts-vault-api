---
name: project-stack
description: The concrete stack patterns for ai-prompts-vault-api — Express handlers/middleware, Drizzle + pg persistence, Zod boundary validation, Vitest/supertest/faker testing, and drizzle-kit migrations, plus path aliases and boundary linting. Use when writing actual code that touches a library. The library-agnostic principles live in the hexagonal-architecture, coding-style, testing, and database-modeling skills.
---

# Project Stack

Concrete, library-specific patterns for this codebase. The principles behind
them live in the `hexagonal-architecture`, `coding-style`, `testing`, and
`database-modeling` skills; the stack summary is in `CLAUDE.md`.

## HTTP (Express)

**`app.ts` order:** leading global middleware (e.g. JWT) → routes + per-route
middleware (e.g. body schema validation) → trailing global middleware (404
handler, error handler).

**Handlers (`src/handlers`):** one function per file, default export only. Never
inline in `app.ts`.

```typescript
import { type Request, type Response } from 'express';
export default (_req: Request, res: Response) => {
    res.status(200).json(null);
};
```

**Middleware (`src/middleware`):** one function per file. Suffix with `Middleware`,
e.g. `ValidationMidleware`.

```typescript
import { type Request, type Response, type NextFunction } from 'express';
export function customMiddleware(req: Request, res: Response, next: NextFunction): void {
    // ...
    next(); // forgetting this hangs the request
}
```

Handlers/middleware reach business logic only via a context's `services.ts`:
`Handler/Middleware -> service (services.ts) -> Application UseCase`.

### Validate-request middleware

`validateRequestMiddleware` (`src/middleware/validateRequest/validateRequestMiddleware.ts`)
is a factory: it takes a `RequestSchema` (`{ params?, query?, body? }` Zod
schemas) and returns Express middleware. It uses `validate()`
(`src/middleware/validateRequest/validation.ts`, a thin wrapper around
`z.object(schema).safeParse`) to parse `req.params`/`req.query`/`req.body`:

- on failure: responds `400 { message, errors: { field, error }[] }` and does
  **not** call `next()`.
- on success: assigns the parsed, typed result to `req.parsedRequest` and calls
  `next()`.

**Schemas (`src/schemas/*Schema.ts`):** one file per handler, default-exporting
a `RequestSchema`-shaped object via `satisfies RequestSchema` — not `as`, which
would widen each field to the generic `ZodTypeAny` and lose the precise shape
handlers need for `z.infer`:

```typescript
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    params: z.object({ id: z.string() }),
} satisfies RequestSchema;
```

**Zod v4 custom error messages:** this project is on Zod v4. Give required
fields a clean message instead of v4's default (`"Invalid input: expected
string, received undefined"`) via the unified `error` param — replaces v3's
separate `required_error`/`invalid_type_error`. For a plain string field, pass
the message directly as the `error` param:

```typescript
import { z } from 'zod';
import { type RequestSchema } from '@src/middleware/validateRequest/validation.js';

export default {
    body: z.object({
        title: z.string({ error: 'Missing required value' }).min(1),
        prompt: z.string({ error: 'Missing required value' }).min(1),
        description: z.string().optional(),
    }),
} satisfies RequestSchema;
```

**UUID fields:** use the top-level `z.uuid()`, not the deprecated
`z.string().uuid()` chain. `z.uuid()` combines the type check and the format
check into one schema, so a single string message would apply to *both* a
missing value and a malformed one. To keep distinct messages for each case,
pass an `error` callback that branches on the issue code:

```typescript
category_id: z.uuid({
    error: (iss) => (iss.code === 'invalid_type' ? 'Missing required value' : 'Invalid UUID value'),
}),
```

**Wiring (`app.ts`):** import the default and pass it straight through:

```typescript
import GetPromptSchema from '@src/schemas/GetPromptSchema.js';

app.get('/prompts/:id', validateRequestMiddleware(GetPromptSchema), getPromptHandler);
```

**Handlers** never read raw `req.params`/`req.query`/`req.body` — they read
the validated `req.parsedRequest`, casting via `z.infer<typeof Schema.field>`:

```typescript
import { type z } from 'zod';
import GetPromptSchema from '@src/schemas/GetPromptSchema.js';

const { id } = req.parsedRequest?.params as z.infer<typeof GetPromptSchema.params>;
```

The `parsedRequest` property on `Request` is an ambient type augmentation in
`src/express.d.ts` (`declare global { namespace Express { interface Request } }`),
kept out of the middleware file itself so the middleware only exports runtime
logic.

## Persistence (Drizzle ORM + pg)

- ORM: Drizzle ORM (`drizzle-orm/node-postgres`)
- Engine: PostgreSQL, via a `pg` connection `Pool`

**Generic client (`src/logic/shared/database/DatabaseClient.ts`):**
`DatabaseClient<DatabaseSchema>` wraps a lazily-created `pg` `Pool` and returns a
Drizzle connection typed against the schema it was constructed with. The same
file also exports `DatabaseConnection<DatabaseSchema>`, a type alias for
`NodePgDatabase<DatabaseSchema>` — use it for any `db` param/return type
instead of importing `NodePgDatabase` from `drizzle-orm/node-postgres`
directly.

```ts
const client = new DatabaseClient(config, schema); // DatabaseSchema inferred from `schema`
const db = client.connect(); // DatabaseConnection<typeof schema> — typed db.query.<table>
await client.close(); // ends the Pool (idempotent)
```

- `config: DatabaseConfig` — `{ host, port, user, password, database }`.
- `schema: DatabaseSchema` — `Record<string, unknown>` of table definitions.
- `connect()` returns `DatabaseConnection<DatabaseSchema>` (alias for
  `NodePgDatabase<DatabaseSchema>`); reuses the existing Pool, safe to call
  repeatedly.
- `close()` no-ops if never connected.

**Schema aggregation (composition root, `config.ts`):**

```ts
import * as promptSchema from '@logic/prompt/infrastructure/database/schema.js';
import * as userSchema from '@logic/user/infrastructure/database/schema.js';

export default {
    database: {
        schema: { ...promptSchema, ...userSchema }, // spread each context — the flat { tableName: table } shape Drizzle expects
    },
};
```

**Wiring (`services.ts`):** passes it straight through — the connection type
follows automatically:

```ts
import { CreatePromptUseCase } from '@logic/prompt/application/CreatePromptUseCase';
import { DrizzlePromptCategoryRepository } from '@logic/prompt/infrastructure/database/DrizzlePromptCategoryRepository';
import { databaseClient } from '@logic/shared/services';

const promptRepository = new DrizzlePromptCategoryRepository(databaseClient);
export const createPromptUseCase = new CreatePromptUseCase(promptRepository);
// databaseClient.connect() is DatabaseConnection<GlobalSchema>
```

Repository classes type their `db` constructor param as `DatabaseConnection`
(imported from `@logic/shared/database/DatabaseClient.js`) rather than
hand-writing `NodePgDatabase<Record<string, unknown>>`:

```ts
import { type DatabaseConnection } from '@logic/shared/database/DatabaseClient.js';

export class DrizzlePromptRepository implements PromptRepositoryInterface {
    constructor(private readonly db: DatabaseConnection) {}
}
```

**Test-side client (`tests/lib/config.ts`):** tests get their own
`databaseClient` instance, built the same way against `src/config.ts`'s
`database` config/schema — kept separate from the app's instance in
`@logic/shared/services.ts` per the `testing` skill's rule that `lib`
resources are restricted to `tests` scope. It also exports
`TestDatabaseConnection = ReturnType<typeof databaseClient.connect>`, the
shared type for any `db` parameter/variable in seeding helpers
(`tests/lib/seeding/*.ts`) and integration tests — the test-side counterpart
to the production `DatabaseConnection` alias, so neither side hand-writes
`NodePgDatabase<Record<string, unknown>>`:

```ts
import { type TestDatabaseConnection } from '@tests/lib/config.js';

export async function insertPromptCategories(
    db: TestDatabaseConnection,
    categories: PromptCategory[],
): Promise<void> {
    // ...
}
```

The `id` (uuid) is app-provided on insert — do not use `defaultRandom()` /
`gen_random_uuid()` defaults.

## Migrations (drizzle-kit)

Managed with the `drizzle-kit` CLI (config in `drizzle.config.ts`). By project
convention we do **not** add npm scripts — run the CLI directly:

```bash
npx drizzle-kit generate   # emit SQL migrations into ./drizzle from the schema files
npx drizzle-kit migrate    # apply pending migrations
```

Generated SQL and metadata are written to `drizzle/`. Database env vars must be
set (see `.env.example`). Migrations are run manually — the app does not migrate
on startup.

## Testing (Vitest)

- Runner: Vitest (`vitest.config.ts`), path aliases via `vite-tsconfig-paths`.
- Mocking: `vitest-mock-extended` for interfaces/classes; native `vi.fn()` for
  functions. Type the held reference as `MockProxy<T>`.
- HTTP assertions: `supertest`.
- Sample data: `@faker-js/faker`.
- Run the suite: `npm test` (`vitest run`, single pass — the CI command).

**Mocking example:**

```ts
describe('CreatePromptUseCase', () => {
    let repository: MockProxy<PromptRepositoryInterface>;
    let useCase: CreatePromptUseCase;

    beforeEach(() => {
        repository = mock<PromptRepositoryInterface>();
        useCase = new CreatePromptUseCase(repository);
    });

    it('stores a new prompt and returns its id', async () => {
        // Arrange
        repository.create.mockResolvedValue(undefined);

        // Act
        const { id } = await useCase.invoke({ title: 'Greet', prompt: 'Hi {name}' });

        // Assert
        expect(repository.create).toHaveBeenCalledOnce();
        expect(id).toBeDefined();
    });
});
```

The Vitest hooks are `beforeAll`/`beforeEach` (setup) and `afterEach`/`afterAll`
(cleanup); the `testing` skill covers when to use them (setup, cleanup, and
database changes) and how to assert errors.

## Tooling

- **Path aliases** (`tsconfig.json`): `@src/*`, `@logic/*`. Use them instead of
  long relative chains.
- **Boundaries**: `eslint-plugin-boundaries` enforces the hexagonal dependency
  rule and blocks deep cross-context reach-ins. `npm run lint` must pass.
- **Formatting**: Prettier owns formatting — 4-space indent, single quotes,
  trailing commas, 100-col width. Don't hand-format.
