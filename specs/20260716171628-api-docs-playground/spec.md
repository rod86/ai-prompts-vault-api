# Spec: Interactive API documentation & playground
Status: IMPLEMENTED
Story: As an API consumer, I want interactive API documentation with a try-it-out playground, generated from the API's own request/response definitions, so that I can explore and test every endpoint from the browser without external tools.

## 1. Behavior

Main flow:

- The service publishes a **machine-readable API description** at a fixed,
  well-known address. It is a single document in an industry-standard format
  that API client tools (such as Postman) can import directly — either by
  pointing the tool at the address or by saving the document as a file
  (decision #13). The document declares:
  - the service's title and version;
  - every live endpoint, grouped by functional area (health, authentication,
    users, prompts — decision #10), each with its inputs, its success output,
    and **exactly the error outcomes it can actually produce** (decision #11);
  - the token-based authentication scheme, with every protected endpoint
    marked as requiring it.
- The service publishes an **interactive documentation page** at a fixed,
  well-known address. The page renders the description document as browsable
  reference documentation with a built-in playground:
  - a consumer can read every endpoint's documentation, grouped by the same
    functional areas;
  - a consumer can execute any endpoint directly from the page ("try it");
    for protected endpoints, the consumer first obtains a token via the
    authentication endpoint and supplies it once through the page's
    authorization control;
  - the page offers a control to **download the description document** for
    import into external tools (decision #13);
  - the page shows the service's icon.
- The description is **derived from the same definitions the service itself
  uses** to validate requests and shape responses (decision #2), so the
  documented inputs cannot drift from the enforced ones, and the documented
  output shapes provably match the real responses (decision #3).
- Requests a consumer fires **from the playground against real endpoints
  behave exactly like any other client's requests** — same validation, same
  errors, same request allowance consumption. The playground is a client, not
  a bypass.

Alternate flows:

- **No allowance for the documentation surface** (decision #6): requests for
  the documentation page, its files, and the description document never
  consume the requester's request allowance and carry no allowance
  information. Every other endpoint keeps its allowance behavior unchanged.
- **Public files** (decision #7): the service has a designated public-files
  area; any file placed there is served as-is at the matching address. The
  documentation page and the service icon live there.
- **Replaceable icon** (decision #8): the icon ships as a placeholder image;
  swapping the file replaces the icon everywhere it appears, with no other
  change.

## 2. Fields

No endpoint gains new request fields. The description document carries fixed
metadata:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| service title | Human-readable name of the API shown in the documentation | text | Yes | the project's name |
| service version | Version of the API the description documents | text | Yes | the project's current version |
| icon | Image shown by the documentation page as the service's icon | image file | Yes | placeholder image |

## 3. Validation rules

None — the feature introduces no new client-supplied fields.

## 4. Error responses

None — the feature introduces no new error responses. Requests for
non-existent files near the documentation surface produce the service's
standard not-found error, unchanged. The description document *documents* the
existing error outcomes; it does not alter any.

## 5. Acceptance criteria

- **AC1** — Given the service is running, when a client requests the
  machine-readable API description, then it receives a successful,
  importable document that declares the description-format version and the
  service's title and version.
- **AC2** — Given the description document, when its health and
  authentication entries are inspected, then the health endpoint and the
  authentication endpoint are present, each listing exactly its real
  outcomes: health — success and allowance exceeded; authentication —
  success, invalid input, invalid credentials, and allowance exceeded.
- **AC3** — Given the description document, when its users entry is
  inspected, then user registration is present, listing exactly its real
  outcomes: success, invalid input, email already in use, and allowance
  exceeded.
- **AC4** — Given the description document, when its prompt entries are
  inspected, then category listing, prompt creation, prompt update, and
  prompt deletion are all present, each listing exactly its real outcomes
  (including not-found, not-owner, and unknown-category/user where the
  endpoint can produce them), the document declares the token-based
  authentication scheme, and prompt creation, update, and deletion are marked
  as requiring it.
- **AC5** — Given valid credentials, when a client authenticates, then the
  response matches the documented authentication success shape exactly.
- **AC6** — Given valid registration data, when a client registers a user,
  then the response matches the documented registration success shape
  exactly.
- **AC7** — Given an authenticated user and valid prompt data, when the user
  creates a prompt, then the response matches the documented prompt shape
  exactly.
- **AC8** — Given an authenticated owner and valid prompt data, when the
  owner updates a prompt, then the response matches the documented prompt
  shape exactly.
- **AC9** — Given existing categories, when a client lists prompt
  categories, then the response matches the documented category-list shape
  exactly.
- **AC10** — Given the service is running, when a client requests the
  documentation page, then it receives a browsable page that loads the
  description document from its published address and references the
  service's icon.
- **AC11** — Given a file in the public-files area (the icon), when a client
  requests its address, then the file is served as-is with its correct
  content type.
- **AC12** — Given the request allowance applies to normal endpoints, when a
  client requests the documentation page and the description document, then
  those responses carry no allowance information, while a normal endpoint's
  response still does.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Which documentation UI approach — served UI package or static page loading the renderer externally? | Static page in the public-files area loading the renderer from an external source (discussed in session) | §1 documentation page; AC10 |
| 2 | Hand-written description vs generated from the service's own request definitions? | Generated from the same definitions used for request validation (discussed in session) | §1 "derived from the same definitions"; input docs cannot drift |
| 3 | How are documented response shapes kept truthful — runtime output checking or proof by tests? | Documented shapes are declaration-only at runtime; truthfulness proven by typed handlers and per-endpoint test assertions (discussed in session) | AC5–AC9 |
| 4 | How is the description content organized? | One general/config unit plus one unit per functional area (discussed in session) | §1 grouping by area |
| 5 | Are the description-content units part of test scope and coverage metrics? | No — excluded from coverage; behavior is pinned only through the published endpoints (discussed in session) | Testing approach; no per-unit criteria |
| 6 | Does the request allowance apply to the documentation surface? | No — documentation page, its files, and the description document are exempt; everything else unchanged (discussed in session) | §1 alternate flow; AC12 |
| 7 | Where do static files live? | A designated public-files area at the project root, served as-is (discussed in session) | §1 alternate flow; AC11 |
| 8 | What icon does the documentation use? | A placeholder image the user will replace later by swapping the file (discussed in session) | §1 alternate flow; §2 icon field |
| 9 | Story confirmation | Confirmed as stated | Story line |
| 10 | Should the health endpoint be included in the description? | Yes — every live endpoint is documented | §1; AC2 |
| 11 | How thoroughly are error outcomes documented per endpoint? | Every real outcome the endpoint can produce — no more, no less | §1; AC2–AC4 |
| 12 | (from discussion) Which addresses serve the documentation? | The documentation page and description document each get a fixed, well-known address (accepted in session) | §1; AC1, AC10 |
| 13 | How should "download for Postman" work? | Via the documentation page's built-in download control plus direct import from the description's address — no extra download endpoint | §1 main flow; AC1 |
