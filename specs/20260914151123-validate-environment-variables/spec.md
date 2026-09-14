# Spec: Validate environment settings at startup
Status: IMPLEMENTED
Story: As an operator deploying this service, I want its environment settings checked when it starts so that a missing or malformed setting stops the service immediately with a clear report, instead of letting it run half-configured and fail later in confusing ways.

## 1. Behavior

Main flow:
1. The service is started.
2. If a local settings file is present, its values are loaded into the environment first. Values already set in the environment are not replaced by the file.
3. Every setting listed in §2 is read from the environment and checked against the rules in §3.
4. Every setting that is valid is converted to its domain type (numbers become numbers, choices become one of their allowed values). Every optional setting that is absent takes its default.
5. The service starts with those checked values. Nothing that uses a setting sees a missing, blank, or mis-typed value.

Alternate flows:
- **No local settings file.** When there is no local settings file, the service does not fail on that. It checks whatever the environment already holds (for example, values supplied by the hosting platform), exactly as in the main flow.
- **One or more settings invalid.** When any setting breaks a rule in §3, the service refuses to start. It prints one report listing **every** invalid setting at once, each with the reason it is invalid, and stops with a failure outcome. It never starts serving requests.
- **Report never reveals values.** The report names each invalid setting and describes what is wrong with it, but never repeats the value that was supplied. A too-short secret, for example, is reported without echoing the secret.
- **Blank value.** A setting that is present but blank counts as supplied, not absent, so its default is **not** used. A blank number or blank choice is therefore invalid. A blank text setting that has no minimum length (the database host, the database password) is accepted as blank.
- **Settings outside the list.** Other values in the environment are ignored. They neither cause a failure nor reach the service's settings.
- **Database tooling.** The standalone database-migration tooling keeps reading its own database settings as it does today. It is not part of this check.

## 2. Fields

All settings are read from the environment by these exact names.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| ENVIRONMENT | Which kind of deployment this is | choice of development / test / production | No | development |
| PORT | Network port the service listens on | number (positive whole) | No | 3000 |
| JWT_SECRET | Secret used to sign and verify access tokens | text (at least 32 characters) | Yes | — |
| JWT_EXPIRATION_SECONDS | How long an issued access token stays valid, in seconds | number (positive whole) | No | 3600 |
| DATABASE_HOST | Host name of the database | text | No | localhost |
| DATABASE_PORT | Port of the database | number (positive whole) | No | 5432 |
| DATABASE_USER | User the service connects to the database as | text (at least 1 character) | Yes | — |
| DATABASE_PASSWORD | Password for that database user | text (may be empty) | No | empty |
| DATABASE_DB | Name of the database to use | text (at least 1 character) | Yes | — |
| RATE_LIMIT_WINDOW_MS | Length of the general request-allowance window, in milliseconds | number (positive whole) | No | 900000 |
| RATE_LIMIT_MAX | Requests allowed per client per general window | number (positive whole) | No | 100 |
| LOGIN_RATE_LIMIT_WINDOW_MS | Length of the failed-login allowance window, in milliseconds | number (positive whole) | No | 900000 |
| LOGIN_RATE_LIMIT_MAX | Failed logins allowed per client per login window | number (positive whole) | No | 5 |
| TRUST_PROXY_HOPS | How many trusted intermediaries sit in front of the service | number (zero or positive whole) | No | 0 |

## 3. Validation rules

- **V1** — `ENVIRONMENT`, when supplied, must be exactly one of `development`, `test`, `production`. Any other value is invalid, including a blank one and a differently-cased one.
- **V2** — `JWT_SECRET` is required and must be at least 32 characters long. Absent is invalid; fewer than 32 characters (blank included) is invalid.
- **V3** — `DATABASE_USER` and `DATABASE_DB` are each required and must be at least 1 character long. Absent is invalid; blank is invalid.
- **V4** — `PORT`, `JWT_EXPIRATION_SECONDS`, `DATABASE_PORT`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_MAX`, when supplied, must each read as a whole number greater than zero. A non-numeric value, a fractional value, zero, a negative value, or a blank value is invalid.
- **V5** — `TRUST_PROXY_HOPS`, when supplied, must read as a whole number of zero or more. Zero is valid; a negative, fractional, non-numeric, or blank value is invalid.
- **V6** — `DATABASE_HOST` and `DATABASE_PASSWORD`, when supplied, may be any text, including blank.
- **V7** — An optional setting that is absent takes the default in §2. A setting that is present but blank is not absent (see V1, V4, V5, V6).

## 4. Error responses

- **E1** — Invalid environment settings: one or more settings break V1–V5. The service does not start. It reports, in one go, every invalid setting by name with the reason each one is invalid, never including the supplied value, and stops with a failure outcome. This is the only error this feature produces. It differs from every runtime error in that it happens before the service accepts any request.

## 5. Acceptance criteria

- **AC1** — Given every setting in §2 is supplied with a valid value, When the settings are checked, Then each value is returned converted to its domain type: numbers as numbers and the environment as its choice. (Covers §1 main flow steps 3–4, §2.)
- **AC2** — Given only the required settings are supplied, When the settings are checked, Then every optional setting takes its default from §2. (Covers V7, §2 defaults.)
- **AC3** — Given `JWT_SECRET`, `DATABASE_USER`, and `DATABASE_DB` are all absent, When the settings are checked, Then an invalid-settings error (E1) is raised that names all three settings together, each with its reason. (Covers V2, V3, E1, §1 "every invalid setting at once".)
- **AC4** — Given a `JWT_SECRET` shorter than 32 characters, When the settings are checked, Then an invalid-settings error (E1) is raised naming `JWT_SECRET` with its reason and without the supplied secret. (Covers V2, E1, §1 "report never reveals values".)
- **AC5** — Given numeric settings that are non-numeric, zero, fractional, and blank, When the settings are checked, Then an invalid-settings error (E1) is raised naming each of those settings with its reason. (Covers V4, V7 blank-is-not-absent, E1.)
- **AC6** — Given `TRUST_PROXY_HOPS` is `0`, When the settings are checked, Then it is accepted as the number zero. (Covers V5.)
- **AC7** — Given a negative `TRUST_PROXY_HOPS`, When the settings are checked, Then an invalid-settings error (E1) is raised naming `TRUST_PROXY_HOPS` with its reason. (Covers V5, E1.)
- **AC8** — Given an `ENVIRONMENT` that is not one of development, test, or production, When the settings are checked, Then an invalid-settings error (E1) is raised naming `ENVIRONMENT` with its reason. (Covers V1, E1.)
- **AC9** — Given `DATABASE_PASSWORD` is supplied blank, When the settings are checked, Then it is accepted as empty text. (Covers V6.)
- **AC10** — Given no local settings file exists, When the service loads its settings file, Then no error is raised and the environment is left unchanged. (Covers §1 "no local settings file" flow.)
- **AC11** — Given a local settings file exists, When the service loads its settings file, Then its values become available in the environment. (Covers §1 main flow step 2.)
- **AC12** — Given an invalid setting in the environment, When the service is started, Then it stops with a failure outcome and prints a report naming the invalid setting without echoing its value. (Covers E1, §1 "one or more settings invalid" and "report never reveals values" flows.)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Loading the local settings file currently fails when the file is missing. Should this spec also change how that file is loaded? | Load the file only if it is present; otherwise check whatever the environment already holds | §1 main flow step 2 and the "no local settings file" flow; AC10, AC11 |
| 2 | How should the failure report be produced? (The proposed formatting call is deprecated in the current version of the validation library; the project's guideline uses a structured tree instead.) | Use the structured per-setting tree the project guideline uses | E1 reports every invalid setting with its reasons in one structured report; AC3–AC5, AC7, AC8, AC12 |
| 3 | Checking settings at startup cannot be tested directly because it stops the process. How should it be split? | Keep the checking as a separate, directly testable step; the startup module only loads the file, runs the check, reports, and stops | AC1–AC9 are phrased as "when the settings are checked" (testable in isolation); AC10–AC11 for file loading; AC12 for the startup behavior |
| 4 | Should the standalone database-migration tooling's settings be checked by the same rules? | No — leave the migration tooling as it is | §1 "database tooling" flow; migration tooling is out of scope |
| 5 | A setting that is present but blank does not take its default. Should a blank value fall back to the default or be invalid? | Blank is invalid, as in the proposed rules; a blank password stays valid | V4, V5, V7 and the §1 "blank value" flow; AC5, AC9 |
