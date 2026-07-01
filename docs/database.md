# Database

- ORM: Drizzle ORM (`drizzle-orm/node-postgres`)
- Engine: PostgreSQL, via a `pg` connection `Pool`
- Migrations: Drizzle Kit CLI

## Generic client (`src/logic/shared/database/DatabaseClient.ts`)

`DatabaseClient<DatabaseConnection, DatabaseSchema>` wraps a lazily-created `pg`
`Pool` and returns a Drizzle connection.

```ts
const client = new DatabaseClient<MyConnection, MySchema>(config, schema);
const db = client.connect(); // creates the Pool on first call, returns drizzle(pool, { schema })
await client.close();        // ends the Pool (idempotent)
```

- `config: DatabaseConfig` — `{ host, port, user, password, database }`.
- `schema: DatabaseSchema` — `Record<string, unknown>` of table definitions.
- `connect()` reuses the existing Pool; safe to call repeatedly.
- `close()` no-ops if never connected.

## Schemas

Table definitions live in each context's infrastructure layer:
`src/logic/<context>/infrastructure/database/schema.ts`

Aggregate schemas in `config.ts` and pass them into the client:

```ts
import * as promptSchema from "@src/logic/prompts/infrastructure/schema.ts";
import * as usersSchema from "@src/logic/users/infrastructure/schema.ts";

export default {
    database: {
        schema: { ...promptSchema, ...usersSchema },
    },
};
```

## Migrations

Managed with the `drizzle-kit` CLI (config in `drizzle.config.ts`). By project
convention we do **not** add npm scripts — run the CLI directly:

```bash
npx drizzle-kit generate   # emit SQL migrations into ./drizzle from the schema files
npx drizzle-kit migrate    # apply pending migrations
```

Generated SQL and metadata are written to `drizzle/`. 
Database env vars must be set (see `.env.example`).
Migrations are run manually — the app does not migrate on startup.