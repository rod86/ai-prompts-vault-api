# Spec: Load and validate environment configuration safely
Status: READY TO IMPLEMENT
Story: As an operator deploying this API, I want configuration to come from the environment, with a local .env file used only when it exists, and checked once at startup, so that the app boots on servers and containers without a .env and refuses to start when a required value is missing or invalid, instead of running misconfigured.

<!--
Operator-facing change: no endpoint, request/response shape, stored data, or client-visible
error changes. The "user" is the person starting the API or running database migrations,
and the "fields" are the environment settings they provide (named exactly as the operator
sets them).
-->

## 1. Behavior
**Main flow — starting the API.**
1. If a local settings file exists at the project's expected location, the settings it
   defines are made available alongside the environment. A setting already provided by the
   environment always keeps the environment's value; the file never overrides it.
2. If no local settings file exists, nothing is loaded and no failure occurs — the
   configuration comes from the environment alone (the normal case on servers and in
   containers).
3. The complete set of settings (§2) is then validated once, as a whole. Settings the
   operator left unset (or set to an empty value) take their default; required settings
   have no default.
4. If every setting is valid, the API starts with that configuration. The configuration
   cannot be changed afterwards while the API runs.

**Alternate flow — invalid configuration.** If any setting is missing or invalid, the API
refuses to start (E1). A single report names every offending setting at once, so the
operator can fix them all in one pass. The report never reveals any provided value.

**Alternate flow — unreadable settings file.** If a local settings file exists but cannot
be read, startup fails with the reason it could not be read (E2).

**Alternate flow — running database migrations.** Database migrations follow exactly the
same rules: the local settings file is optional, the whole set of settings in §2 is
validated (including settings the migrations themselves don't use, such as JWT_SECRET),
and migrations refuse to run on E1 or E2.

Environment variables not listed in §2 are ignored.

## 2. Fields
Every setting the application reads is declared here; nothing is read from the environment
outside this list.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| ENVIRONMENT | Deployment environment the API runs in | choice of development / staging / production | No | development |
| PORT | Port the API listens on | number (whole, 1–65535) | No | 3000 |
| DATABASE_HOST | Database server host | text | No | localhost |
| DATABASE_PORT | Database server port | number (whole, 1–65535) | No | 5432 |
| DATABASE_USER | Database user name | text | **Yes** | — |
| DATABASE_PASSWORD | Database user password | text (may be empty) | No | empty |
| DATABASE_DB | Database name | text | **Yes** | — |
| JWT_SECRET | Secret used to sign and verify access tokens | text | **Yes** | — |
| JWT_EXPIRATION_SECONDS | Access-token lifetime, in seconds | number (whole, ≥ 1) | No | 3600 |
| RATE_LIMIT_WINDOW_MS | General request-allowance window, in milliseconds | number (whole, ≥ 1) | No | 900000 |
| RATE_LIMIT_MAX | Requests allowed per general window | number (whole, ≥ 1) | No | 100 |
| TRUST_PROXY_HOPS | Number of trusted proxies in front of the API | number (whole, ≥ 0) | No | 0 |
| LOGIN_RATE_LIMIT_WINDOW_MS | Failed-login allowance window, in milliseconds | number (whole, ≥ 1) | No | 900000 |
| LOGIN_RATE_LIMIT_MAX | Failed login attempts allowed per window | number (whole, ≥ 1) | No | 5 |

## 3. Validation rules
- **V1** — JWT_SECRET, DATABASE_USER and DATABASE_DB are required: each must be provided
  with a non-empty value. Missing (or empty, see V2) is invalid.
- **V2** — A setting provided with an empty value is treated exactly as if it were not
  provided: an optional setting takes its default (DATABASE_PASSWORD's default is itself
  empty), and a required setting is invalid.
- **V3** — ENVIRONMENT, when provided, must be exactly one of `development`, `staging`,
  `production`. Any other value is invalid.
- **V4** — PORT and DATABASE_PORT, when provided, must be whole numbers from 1 to 65535.
  Non-numeric, fractional, or out-of-range values are invalid.
- **V5** — JWT_EXPIRATION_SECONDS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS and LOGIN_RATE_LIMIT_MAX, when provided, must be whole numbers
  greater than or equal to 1. Non-numeric, fractional, zero, or negative values are invalid.
- **V6** — TRUST_PROXY_HOPS, when provided, must be a whole number greater than or equal
  to 0. Non-numeric, fractional, or negative values are invalid.
- **V7** — Environment variables not listed in §2 are ignored: they never make the
  configuration invalid and never become part of it.

## 4. Error responses
- **E1 — Invalid configuration.** Trigger: one or more settings break V1–V6. The API does
  not start (and migrations do not run). The operator is told that the environment is
  invalid and given the names of **all** offending settings in one report. The report
  never contains any provided value (so a secret can't leak into logs). Distinguished from
  E2 by naming settings rather than a file problem.
- **E2 — Unreadable settings file.** Trigger: a local settings file exists at the expected
  location but cannot be read. Startup (or migrations) fail with the reason the file could
  not be read. Distinguished from E1 by occurring before any setting is validated. A
  *missing* file is not an error (see §1).

## 5. Acceptance criteria
- **AC1** — Given no local settings file exists, When the configuration is loaded, Then
  loading completes without failure and no setting is added to the environment.
- **AC2** — Given a local settings file exists, When the configuration is loaded, Then the
  settings it defines become available in the environment.
- **AC3** — Given a setting is already provided by the environment and the local settings
  file defines the same setting with a different value, When the configuration is loaded,
  Then the environment's value is kept.
- **AC4** — Given something exists at the local settings file's location but cannot be
  read as a file, When the configuration is loaded, Then loading fails with the reason it
  could not be read. (E2)
- **AC5** — Given only JWT_SECRET, DATABASE_USER and DATABASE_DB are provided, When the
  configuration is validated, Then it is accepted and every other setting takes its default
  value. (V1)
- **AC6** — Given every setting is provided with a valid value, including ENVIRONMENT set
  to staging, When the configuration is validated, Then it is accepted and each setting
  holds the provided value, with numeric settings held as numbers. (V3, V4, V5, V6)
- **AC7** — Given JWT_SECRET, DATABASE_USER and DATABASE_DB are all missing, When the
  configuration is validated, Then it is rejected and the report names all three settings.
  (V1, E1)
- **AC8** — Given PORT is provided with an empty value, When the configuration is
  validated, Then it is accepted and PORT takes its default value. (V2)
- **AC9** — Given JWT_SECRET is provided with an empty value, When the configuration is
  validated, Then it is rejected and the report names JWT_SECRET. (V1, V2, E1)
- **AC10** — Given ENVIRONMENT is provided as "prod", When the configuration is validated,
  Then it is rejected and the report names ENVIRONMENT. (V3, E1)
- **AC11** — Given PORT is provided as "65536" and DATABASE_PORT as "abc", When the
  configuration is validated, Then it is rejected and the report names both PORT and
  DATABASE_PORT. (V4, E1)
- **AC12** — Given JWT_EXPIRATION_SECONDS is provided as "1.5" and RATE_LIMIT_MAX as "0",
  When the configuration is validated, Then it is rejected and the report names both
  JWT_EXPIRATION_SECONDS and RATE_LIMIT_MAX. (V5, E1)
- **AC13** — Given TRUST_PROXY_HOPS is provided as "-1", When the configuration is
  validated, Then it is rejected and the report names TRUST_PROXY_HOPS. (V6, E1)
- **AC14** — Given a setting is rejected, When the report is produced, Then the report
  contains the setting's name but not the value that was provided for it. (E1)
- **AC15** — Given environment variables not listed in the settings are present alongside
  valid settings, When the configuration is validated, Then it is accepted and those
  variables are not part of the configuration. (V7)
- **AC16** — Given a valid configuration has been built, When anything attempts to change
  one of its settings, Then the change is refused and the settings keep their values.
- **AC17** — Given the API is started, When its configuration is prepared, Then the local
  settings file is loaded only if it exists and the whole configuration is validated before
  the API accepts requests, refusing to start if it is rejected. (E1, E2)
- **AC18** — Given database migrations are run, When their configuration is prepared, Then
  the local settings file is loaded only if it exists and the whole configuration is
  validated with the same rules as the API, refusing to run if it is rejected. (E1, E2)

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Confirm the story: configuration from the environment, local .env optional, checked once at startup, refusing to start on missing/invalid values? | Confirmed (both halves: optional file **and** startup validation). | Story line; §1 main + invalid-configuration flows; E1. |
| 2 | Which settings should be required (no default)? | JWT_SECRET, DATABASE_USER, DATABASE_DB. Everything else keeps its current default; DATABASE_PASSWORD may be empty. | §2 Required/Default columns; V1; AC5, AC7, AC9. |
| 3 | Should JWT_SECRET also have a minimum length? | Question declined by the user (not answered). | No length rule added; "required" means present and non-empty only (V1). Logged as an assumption in plan.md §7. |
| 4 | How should a set-but-empty value (e.g. `PORT=`) be treated? | Same as unset: optional → default, required → invalid; DATABASE_PASSWORD stays allowed empty. | V2; AC8, AC9. |
| 5 | Is the migrations config in scope? | Yes, same rules as the API. | §1 migrations flow; AC18. |
| 6 | Should ENVIRONMENT be limited to a fixed set of values? | Yes: development / staging / production (default development). | §2 ENVIRONMENT type; V3; AC6, AC10. |
| 7 | (User instruction, given unprompted during planning) | The schema must declare all env vars. | §2 lists every setting and states nothing is read outside it; one declaration covers the whole configuration. |
| 8 | With one schema, should migrations validate the whole schema or only its database subset? | Validate the whole schema. | §1 migrations flow: JWT_SECRET etc. must also be valid where migrations run; AC18. |
