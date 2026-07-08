---
name: database-schema-design
description: Engine-agnostic relational schema-design conventions — table and column naming, primary and foreign keys, surrogate vs natural keys, normalization and denormalization, UTC datetime columns, soft vs hard deletes, enums and value sets, money and precision types, nullability, constraints and indexes, audit and concurrency columns, and migration discipline. Applies to any SQL engine (Postgres, MySQL, SQLite, SQL Server). Use when designing a database, tables, columns, keys, an ERD or data model, when normalizing a schema, or writing migrations.
---

# Database Schema Design

Conventions for modeling data in a relational database, independent of the SQL
engine. DDL syntax and some column types differ per engine (Postgres, MySQL,
SQLite, SQL Server); portable choices are called out where it matters.

## Quick rules

- Tables: lowercase `snake_case`, plural, spelled out in full.
- Primary key named `id`; prefer a stable surrogate key.
- Foreign keys named `<referenced_table_singular>_id`, with a real FK constraint.
- Datetime columns suffixed `_at`, stored in UTC.
- `NOT NULL` by default; nullable only when absence is meaningful.
- Money uses `DECIMAL`/`NUMERIC`, never floats.
- Index every foreign key; enforce uniqueness with `UNIQUE` constraints.
- One kind of record per table — no polymorphic "type" tables.
- Schema changes ship as versioned, reviewed migrations.

## Table conventions

- **Naming**: table names are lowercase `snake_case`, plural, and spelled out in
  full — no abbreviations (e.g. `prompts`, `categories`).
- **Child tables**: a table whose rows belong to a parent table is prefixed with
  the parent's name, e.g. `prompt_categories` for categories that belong to a
  prompt.
- **Join tables**: a many-to-many relationship uses a join table named by
  combining both table names, e.g. `prompts_tags` linking `prompts` and `tags`.
- **One thing per table**: each table models a single kind of record. Avoid
  shared or polymorphic tables that mix unrelated record types behind a "type"
  column.
- **Primary key**: every table has a primary key.

## Keys

- **Primary key**: name it `id`. Prefer a stable surrogate key over a natural
  key so the identifier never has to change when data changes.
- **Surrogate key type** — trade-offs, not a mandate:
  - **UUID**: globally unique, portable across databases, and can be generated
    anywhere (client, app, or DB) before the row exists. Wider and non-sequential.
  - **Auto-increment integer**: compact and sequential, good for locality and
    index size, but only unique within one table/DB and requires a round-trip
    (or DB default) to obtain.
- **Who generates the key**: both are valid — a DB-generated default (identity
  column / `DEFAULT` UUID function) or a value supplied by the writer on insert.
  Supplying the value up front lets the writer know the id before the row is
  persisted; a DB default keeps insert statements simpler. Pick one convention
  and apply it consistently.
- **Foreign keys**: name them after the referenced table's singular form with an
  `_id` suffix, e.g. `prompt_id` referencing `prompts.id`. Back every foreign key
  with an actual `FOREIGN KEY` constraint.

## Column conventions

- **Naming**: column names are `snake_case`.
- **Datetime columns**: suffix with `_at` (e.g. `created_at`, `updated_at`,
  `expires_at`) and store values in **UTC** to avoid timezone ambiguity. Use the
  engine's timezone-aware timestamp type where available (Postgres
  `timestamptz`; other engines vary — some store UTC in a plain timestamp type
  by convention).
- **Nullability**: columns are `NOT NULL` by default. Make a column nullable only
  when an absent value is a genuine, meaningful state for the data.
- **Defaults**: prefer explicit values over implicit database defaults where it
  makes the data's origin clearer.

## Column types

- **Money & exact numbers**: use `DECIMAL`/`NUMERIC` with explicit precision and
  scale. Never store money or any value requiring exactness in `FLOAT`/`REAL` —
  binary floats can't represent decimal fractions exactly.
- **Text**: use a variable-length text type; only cap length (`varchar(n)`) when
  a real domain limit exists, not as a guess. Don't pad with fixed-length `char`
  unless the value is genuinely fixed-width.
- **Booleans**: use the native boolean type where available; otherwise a
  `0/1 SMALLINT` with a `CHECK` constraint.
- **JSON**: use a JSON column for genuinely schemaless or variable payloads —
  not as a catch-all to avoid modeling columns you know you need (see
  anti-patterns).

## Normalization & denormalization

- **Default to normalized** (roughly third normal form): each fact lives in
  exactly one place, so there's no update anomaly where copies drift apart.
- **Denormalize deliberately**, never by accident: duplicate or precompute data
  only for a measured read-path need (hot aggregates, read-heavy joins). When you
  do, document what keeps the copies consistent (trigger, job, application write)
  — otherwise they will diverge.
- Computed/derived values that are cheap to recompute usually belong in a query
  or a generated column, not a hand-maintained duplicate.

## Enums & constrained value sets

Three ways to constrain a column to a fixed set of values:

- **`CHECK` constraint** on a text/int column: portable and simple; changing the
  allowed set is a migration.
- **Lookup/reference table** + foreign key: the most flexible — values become
  data you can add rows to, annotate, and join against. Preferred when the set
  grows or carries extra attributes.
- **Native `ENUM` type**: compact but the least portable — syntax and alteration
  rules differ sharply across engines. Avoid when portability matters.

## Deletes

- Decide **soft vs hard delete** per table:
  - **Hard delete**: the row is removed. Set FK `ON DELETE` behavior explicitly —
    `CASCADE` to remove dependents, `RESTRICT`/`NO ACTION` to forbid deleting a
    referenced row, `SET NULL` to detach.
  - **Soft delete**: keep the row and mark it with a `deleted_at` timestamp
    (nullable; non-null means deleted). Remember every query and unique
    constraint must then account for soft-deleted rows.
- Don't mix silently — a table is soft-deleted or it isn't; make it obvious.

## Audit & concurrency columns

- **Audit**: `created_at` and `updated_at` on most tables. Be explicit about who
  sets `updated_at` (a DB trigger or every writer) and apply it consistently.
- **Optimistic locking**: for rows updated concurrently, add a `version` integer
  bumped on every update; writers check the expected version to detect a
  conflicting concurrent write instead of silently overwriting it.

## Constraints & indexes

- Enforce natural keys and other "no duplicates" rules with `UNIQUE` constraints.
- Index foreign key columns — they are the columns you join and filter on.
- Rely on `FOREIGN KEY` constraints for referential integrity rather than
  enforcing it only in application code.

## Anti-patterns

- **Reserved words as identifiers** (`order`, `user`, `group`, `select`) — forces
  quoting everywhere and breaks unquoted queries; pick a non-reserved name.
- **Catch-all `data`/`info`/`meta` JSON columns** used as a default dumping
  ground instead of modeling columns you already know you need.
- **Unindexed foreign keys** — joins and cascade deletes scan the whole table.
- **Storing local time** or timezone-naive timestamps for events — store UTC.
- **Floats for money** — see column types.
- **Polymorphic tables** with a `type` discriminator mixing unrelated records.
- **Stringly-typed everything** — a `varchar` column holding numbers, booleans,
  or dates defeats the database's type checking.

## Example

```sql
-- parent table
CREATE TABLE prompts (
    id          uuid        NOT NULL,
    title       text        NOT NULL,
    status      text        NOT NULL,            -- constrained below
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL,
    deleted_at  timestamptz,                      -- soft delete: NULL = live
    PRIMARY KEY (id),
    CONSTRAINT prompts_status_check
        CHECK (status IN ('draft', 'published', 'archived'))
);

-- child table (belongs to a prompt)
CREATE TABLE prompt_categories (
    id         uuid        NOT NULL,
    prompt_id  uuid        NOT NULL,
    name       text        NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT prompt_categories_prompt_id_fkey
        FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    CONSTRAINT prompt_categories_prompt_id_name_key UNIQUE (prompt_id, name)
);
CREATE INDEX prompt_categories_prompt_id_idx ON prompt_categories (prompt_id);

-- many-to-many join table
CREATE TABLE prompts_tags (
    prompt_id uuid NOT NULL,
    tag_id    uuid NOT NULL,
    PRIMARY KEY (prompt_id, tag_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)    REFERENCES tags (id)    ON DELETE CASCADE
);
CREATE INDEX prompts_tags_tag_id_idx ON prompts_tags (tag_id);
```

## Portability notes

DDL is not fully portable — keep these engine differences in mind:

- **Identifier casing**: unquoted identifiers fold to lowercase in Postgres and
  are case-insensitive in MySQL/SQL Server. Stick to lowercase `snake_case` to
  sidestep it. Avoid quoted mixed-case names.
- **UUID type**: native `uuid` in Postgres; MySQL commonly uses
  `BINARY(16)`/`CHAR(36)`; SQL Server uses `UNIQUEIDENTIFIER`; SQLite uses text.
- **Auto-increment**: `GENERATED ... AS IDENTITY` (SQL standard / Postgres),
  `AUTO_INCREMENT` (MySQL), `IDENTITY` (SQL Server), `AUTOINCREMENT` (SQLite).
- **Timezone-aware timestamps**: `timestamptz` (Postgres); others vary — some
  lack a true timezone-aware type and rely on a UTC-by-convention timestamp.
- **Native `ENUM`**: Postgres and MySQL both have one but with different syntax
  and alteration rules; SQL Server and SQLite don't — use `CHECK` or a lookup
  table for portability.

## Migrations

- Schema changes go through versioned, reviewed migration files — one change per
  migration, applied in order.
- Migrations run deliberately (as an explicit step), not silently on application
  startup.
- Commit the generated SQL and any migration metadata as artifacts so the schema
  history is reproducible.
