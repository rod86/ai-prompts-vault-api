---
name: migrations
description: How drizzle-kit migrations are run and authored in ai-prompts-vault-api
metadata:
  type: project
---

- `npx drizzle-kit generate` then `npx drizzle-kit migrate` — run manually; the
  app never migrates on startup, and there are no npm scripts.
- Seed rows and any down/reversal steps are hand-authored with literal UUIDs.
- Postgres runs via `docker-compose.yml` (`ai-prompts-vault-api-postgres`,
  port 5432). If `npx drizzle-kit migrate`/other DB commands hang or refuse to
  connect, first check `docker ps` / `docker compose up -d` — it is not
  started automatically.
- `npx drizzle-kit migrate`'s CLI spinner can silently swallow real errors and
  exit 1 with no visible message (observed on this project's drizzle-kit
  version even against a healthy, reachable database). If it hangs/fails
  opaquely, apply the migration by calling `drizzle-orm/node-postgres/migrator`'s
  `migrate(db, { migrationsFolder: './drizzle' })` directly in a one-off
  `node -e` script (build the `db` the same way `DatabaseClient` does, via
  `drizzle(pool)`) — this reliably surfaces the real error or applies cleanly
  when the CLI doesn't. Verify success by querying
  `drizzle.__drizzle_migrations` / `pg_tables` directly rather than trusting
  the CLI's own exit output.
