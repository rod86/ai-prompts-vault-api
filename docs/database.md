# Database

- ORM: Drizzle ORM
- Migrations: Drizzle Kit CLI
- Database Engine: PostgreSQL (accessed via `drizzle-orm/node-postgres` driver over a `pg` connection `Pool`)

## Generic client (`src/logic/shared/database`)


## Schemas

Table definitions live in the infrastructure layer of each context:

```
src/logic/<context>/infrastructure/database/schema.ts
```

## Migrations

Managed with the `drizzle-kit` CLI (config in `drizzle.config.ts`). By project
convention we do **not** add npm scripts — run the CLI directly:

```bash
npx drizzle-kit generate   # emit SQL migrations into ./drizzle from the schema files
npx drizzle-kit migrate    # apply pending migrations to DATABASE_URL
```

Generated SQL and migration metadata are written to the `drizzle/` directory.
`DATABASE_URL` must be set (see `.env.example`). Migrations are run manually — the app
does not migrate on startup.
