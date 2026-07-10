# Spec: Establish the database connection once at startup
Status: READY TO IMPLEMENT
Story: As a developer maintaining the service, I want the shared database connection to be established once when the application starts and reused everywhere, so that the service uses a single connection resource and misuse is caught immediately.

<!--
WHAT, not HOW. Describes the observable behavior of the shared database-access
component: its connect/access/release lifecycle. No frameworks, libraries, or file
names here.
-->

## 1. Behavior

The service has one shared database-access component with a three-part lifecycle:

**Main flow**
1. When the application starts, it **establishes** the connection once. Establishing
   reserves the underlying connection resource and prepares a ready-to-use connection.
2. While the application runs, any part that needs the database **asks the component for
   the connection** and receives the same single, already-established connection every
   time — no new resource is reserved per request.
3. When the application shuts down, it **releases** the connection, freeing the resource.

**Alternate flows**
- **Establish is repeatable but has no extra effect.** Asking to establish when the
  connection is already established does nothing further — still exactly one resource.
- **Access before establish is refused.** If any part asks for the connection before it
  has been established, the request is refused with a clear signal that the connection is
  not ready (rather than silently creating one on demand).
- **Release without a prior establish is harmless.** Asking to release when nothing was
  established completes quietly and does nothing.
- **Re-establish after release starts fresh.** After a release, establishing again
  reserves a brand-new resource and prepares a new connection; access works again.
- **Access after release is refused** in the same way as access before establish, until
  a new establish happens.

## 2. Fields

None — this feature changes no stored data and no request/response fields. It only
changes the lifecycle of the shared database-access component.

## 3. Validation rules

- **V1** — The connection may only be handed out after it has been established. Asking
  for the connection while none is established is invalid.

## 4. Error responses

- **E1** — *Connection not established.* Triggered when a caller asks for the connection
  before an establish (or after a release with no re-establish). The caller is told the
  database connection has not been established and must be established first. It is
  distinguished from all other failures by being about lifecycle state, not about any
  query or data.

## 5. Acceptance criteria

- **AC1** — *Establish reserves exactly one resource.* Given a fresh component, When it
  is established and then asked for the connection several times, Then only one underlying
  connection resource is reserved and the same connection is returned each time.
- **AC2** — *Access before establish is refused.* Given a component that has not been
  established, When a caller asks for the connection, Then the request is refused with the
  "connection not established" signal (E1) and no resource is reserved. *(covers V1, E1)*
- **AC3** — *Establish is idempotent.* Given an already-established component, When
  establish is requested again, Then still exactly one resource has been reserved.
- **AC4** — *Release frees the resource and re-locks access.* Given an established
  component, When it is released, Then the resource is freed and a subsequent request for
  the connection is refused with E1. *(covers E1)*
- **AC5** — *Release without establish is a safe no-op.* Given a component that was never
  established, When release is requested, Then it completes quietly and frees nothing.
- **AC6** — *Re-establish after release starts fresh.* Given a component that was
  established and then released, When it is established again, Then a new resource is
  reserved and asking for the connection succeeds.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | How should callers receive the connection? | The component exposes it via an access request; callers ask per use and get the single established connection. | Shapes §1 step 2 and AC1 — access is a getter, separate from establish. |
| 2 | Should establishing verify connectivity (fail fast at startup)? | No — establishing only reserves the resource; the first real query surfaces any connectivity problem. | No connectivity-check behavior in §1; keeps establish lazy. |
| 3 | Where should the "connection not established" error live? | Alongside the database component, treated as a technical/infrastructure signal, not a domain-rule violation. | Recorded for plan §3; E1 stays a lifecycle signal, not a domain error. |
| 4 | What is the scope of the change? | The newer shared component only; the legacy duplicate and the test-suite's own component instance are left unchanged. | Bounds the spec to the one shared component; no behavior change elsewhere. |