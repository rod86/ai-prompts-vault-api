# Spec: Legacy scaffolding cleanup before route/handler migration
Status: IMPLEMENTED
Story: As a maintainer, I want the legacy business-logic tree, the request-validation
library and layer, and every HTTP endpoint except the health check removed — and the
configuration reorganized — so that the codebase is a clean, unambiguous base for
migrating routes and handlers onto the modules architecture.

<!--
This is a structural cleanup, not a runtime feature. The "user" is the maintainer of the
codebase; the observable behavior is the shape of the codebase and the surviving HTTP
surface. No new runtime validation or error behavior is introduced — behavior is only
removed. File-level and library-level specifics live in plan.md.
-->

## 1. Behavior

Main flow (the cleaned codebase):

- The service exposes exactly **one** HTTP endpoint: the health check, which continues to
  respond with a success status and an `ok` body. Every previously-available endpoint
  (prompt listing/read/create/update/delete, category listing, user registration, and
  authentication) is removed.
- The **legacy business-logic tree** (the old duplicate contexts that were being migrated
  away) no longer exists anywhere in source or tests. The modules architecture is the only
  home for business logic.
- The **request-validation library** and the **per-request validation layer** (the
  validation middleware, its per-endpoint schemas, and the request-augmentation typing it
  relied on) no longer exist and the validation library is no longer a project dependency.
- **Configuration is split into two units**: one holding environment values and fixed
  parameters, and one holding the aggregated persistence schema (default-exported).
  Everything that previously read the schema out of the single configuration unit now
  reads it from the dedicated schema unit; the modules and the test support code import
  the schema from there.
- The migration tooling continues to resolve the persistence schema from the surviving
  (modules) source, not from the removed legacy tree.
- The whole automated test suite, type-check, and lint all pass.
- The project guide documentation no longer references the removed legacy tree, the
  removed validation library, or the removed validation layer.
- The **old-format spec folders** (the pre-timestamp numbered folders, `009` and earlier)
  are removed so they cannot interfere with or be mistaken for the current specs in future
  planning.

Alternate flow (removed endpoints):

- A request to any endpoint other than the health check is not matched by any route and
  receives the standard not-found response.

## 2. Fields

None — this cleanup introduces no data model, field, or persistence-shape changes. The set
of stored tables is unchanged.

## 3. Validation rules

None introduced. This change removes the request-validation layer; it adds no new rules.

## 4. Error responses

| # | Trigger | What the user is told | Distinguished by |
| - | ------- | --------------------- | ---------------- |
| E1 | A request targets any endpoint other than the health check | The standard "not found" response | It is the default no-route-matched response, not a validation or domain error |

## 5. Acceptance criteria

- **AC1** — Given the running service, When a client requests the health check endpoint,
  Then it responds with a success status and an `ok` body.
- **AC2** — Given the running service, When a client requests a previously-available
  endpoint (e.g. the prompt-list endpoint), Then it receives the not-found response
  (covers E1).
- **AC3** — Given the source and test trees, When they are inspected, Then no legacy
  business-logic tree remains and nothing imports it.
- **AC4** — Given the project, When dependencies and source are inspected, Then the
  request-validation library is not a dependency and is imported nowhere.
- **AC5** — Given the source tree, When it is inspected, Then the request-validation
  middleware, its per-endpoint schemas, and the request-augmentation typing no longer
  exist.
- **AC6** — Given configuration, When it is inspected, Then it is split into an
  environment/parameters unit and a dedicated aggregated-schema unit (default-exported),
  and every schema consumer reads the schema from the dedicated unit.
- **AC7** — Given the cleaned repository, When the type-check, lint, and full test suite
  are run, Then all three pass.
- **AC8** — Given the migration tooling, When it resolves the persistence schema, Then it
  reads it from the surviving modules source, not the removed legacy tree.
- **AC9** — Given the project guide documentation, When it is read, Then it no longer
  references the removed legacy tree, the removed validation library, or the removed
  validation layer.
- **AC10** — Given the specs directory, When it is inspected, Then the old-format numbered
  spec folders (`009` and earlier) no longer exist and only timestamp-format folders
  remain.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Moving the aggregated schema out of the single config unit removes a value that is read well beyond the modules (legacy services, a legacy repo's type, test support, and several module integration tests). How should the schema-import rewire be scoped? | Remove the legacy business-logic tree entirely and its tests too; update **all** other references, including tests. | Expanded scope from "split config" to a full legacy removal: AC3 added; AC6/AC7/AC8 cover the rewire of every schema/config consumer. |
| 2 | Should the eslint boundary rules be updated as part of this cleanup? | Yes — update the eslint boundaries. | Tooling cleanup (removing the legacy boundary patterns) is in scope; contributes to AC7. |
| 3 | Removing the legacy tree, the validation library, the validation layer, and the handlers makes large parts of the project guide documentation stale. Should this cleanup update it now? | Update the project guide documentation now. | AC9 added — documentation is corrected in this spec rather than deferred. |
| 4 | Should the old-format numbered spec folders be deleted too? | Yes — delete the old spec format (`009-login` and earlier) to avoid interference in future plans. | AC10 added — the nine pre-timestamp numbered folders are removed. |
