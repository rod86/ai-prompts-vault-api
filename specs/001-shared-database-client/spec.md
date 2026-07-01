# Spec — Shared Database Client

> **Plan area, step 2.** WHAT and WHY only. No tech, no file names, no
> frameworks. See [docs/spec-driven.md](../../docs/spec-driven.md).

## User story

As an API operator, I want a single shared database client that opens the database
connection when the API starts and releases it when the API stops, so that every part of
the application persists data through one managed connection and the process starts and
shuts down cleanly.

## Summary

The application needs one place that owns the lifecycle of the database connection. This
feature introduces a reusable client that is created with a data schema and the
connection settings, then exposes two operations: open the connection and hand it back to
callers, and close the connection when it is open. The API opens the connection during
startup and closes it during shutdown, so connections are never leaked and no bounded
context has to manage the connection itself.

## Behavior

- The client is created with a data schema and a connection configuration (the settings
  needed to reach the database).
- Opening the connection establishes it if it is not already open, and returns a usable
  connection bound to the provided schema.
- Opening is idempotent: opening an already-open client returns and reuses the same live
  connection rather than establishing a second one.
- Closing releases the connection when one is open.
- Closing when nothing is open does nothing and does not fail.
- The API opens the connection on startup and closes it on shutdown.

## Fields

The configuration the client is created with:

| Field    | Type   | Required | Rules / constraints                          |
| -------- | ------ | -------- | -------------------------------------------- |
| schema   | object | Yes      | The data schema the connection is bound to.  |
| host     | string | Yes      | Database host address.                       |
| port     | number | Yes      | Database port.                               |
| user     | string | Yes      | Database user name.                          |
| password | string | Yes      | Database user password.                      |
| database | string | Yes      | Name of the database to connect to.          |

## Validation rules

- All connection configuration values are required to open a connection.

## Error responses

Reframed for infrastructure (this feature exposes no HTTP surface):

| Condition                                   | Response                                          |
| ------------------------------------------- | ------------------------------------------------- |
| The connection cannot be established        | The underlying error surfaces to the caller (startup fails loudly). |
| Close is requested while nothing is open    | No-op; no error is raised.                         |

## Acceptance criteria (testable)

- [ ] Given a schema and configuration, when the connection is opened, then a usable
      connection bound to that schema is returned.
- [ ] Given the connection has already been opened, when it is opened again, then the same
      live connection is reused rather than a new one being established.
- [ ] Given an open connection, when it is closed, then the connection is released.
- [ ] Given nothing is open, when close is requested, then it is a no-op and does not fail.
- [ ] Given the API starts, then the connection is opened; and given the API shuts down,
      then the connection is closed.

## Out of scope

- Migrations and any migration tooling/configuration.
- Defining the actual database tables/schema for any bounded context.
- Any bounded-context repositories, use cases, or query logic.
- Connection-pool tuning, retries, or automatic reconnection.
- Health checks or connection monitoring.
- Reconciling a single connection URL versus discrete connection settings.
