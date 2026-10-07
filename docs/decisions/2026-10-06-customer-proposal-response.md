# Customer Proposal Response — Request Changes and Accept

**Status:** Accepted and implemented. Founder approval: Approved 2026-10-06.  
**Date:** 2026-10-06  
**Founder approval:** Approved 2026-10-06  
**Scope:** Smallest durable customer response slice for a published proposal — an explicit, version-bound *Request Changes* and *Accept Proposal* action, and nothing else  
**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation, Founder/Internal Workspace and Project Intake review, Founder Project Queue, Proposal Foundation, Customer Proposal Review

> **Status note.** The Founder approved this design on 2026-10-06, and it remains
> the governing design for the Customer Proposal Response slice. **Design
> accepted on 2026-10-06; implementation completed and merged in PR #45 (merge
> commit `d9c95f265393197878fe55a5820a26e00e8fe0a9`).** Implementation is not
> deployment: the slice is not deployed, is not activated for live customers, and
> has processed no live customer data. Production deployment, provider
> activation, and every capability listed in section 5 remain separately
> controlled and each still requires its own later decision.

## 1. Status

**Status: Accepted and implemented. Founder approval: Approved 2026-10-06.**

This document is the approved design for the Customer Proposal Response slice.
The Founder approved it on 2026-10-06; it was subsequently implemented and merged
into `main`.

The lifecycle must be read in three separate steps, and none implies the next:

- **The ADR/design is accepted.** This design is the governing specification for
  the slice. Implementation does not alter its design or its business rules.
- **The implementation is completed and merged.** The slice described here was
  implemented in PR #45 (merge commit
  `d9c95f265393197878fe55a5820a26e00e8fe0a9`) and is now part of `main`.
- **The capability is not deployed.** Implementation is not deployment or
  production availability: the slice is not deployed, is not activated for live
  customers, and has processed no live customer data. Acceptance and
  implementation of a design are not delivery to customers.

Approval and implementation of this design authorize only the proposal-response
slice described here. They do not authorize deployment, publication, live
customer-data operation, provider activation, or any excluded capability in
section 5.

## 2. Context

Three accepted decisions establish the ground this design stands on.

**Proposal Foundation**
(`docs/decisions/2026-10-05-proposal-foundation.md`, Accepted 2026-10-05) gives
the platform a durable proposal record: one proposal per project, immutable
numbered versions, exactly two version statuses (`draft`, `published`),
Founder-only authoring through the `founder` internal capability, and an
explicit, idempotent, audited publication act. Publishing records an instant and
does **not** mean the customer has seen or accepted anything. The same decision
fixes proposal version immutability, deterministic version numbering, and the
rule that creating or publishing a version never moves the customer-facing
project stage.

**Customer Proposal Review**
(`docs/decisions/2026-10-06-customer-proposal-review.md`, Accepted 2026-10-06;
implemented and merged as PR #43, merge commit
`c4bf074cf822d0e9a03460e3fa12ae2b19379d34`, on 2026-10-06) makes the current
published version readable by an authorized customer at
`/dashboard/projects/{reference}/proposal`. That slice is deliberately
read-only: the page has no form and no state-changing control, reading performs
no write, creates no audit event, changes no project stage, and there is no
customer JSON endpoint. Its section 13 lists *request changes* and *customer
acceptance* as non-goals and states that each requires its own later, separate
Founder decision. This document is that separate decision.

**The approved requirements**
(`docs/website/customer-platform-requirements.md`) describe the workflow this
design belongs to:

> **Qualified opportunity → Proposal → Customer review → Request changes or
> accept** (§12)

and require that customer acceptance record enough evidence to identify the
customer identity, organization, project, proposal version, acceptance action,
and date/time. Section 19 requires that where customer action is required the
action is explicit and the approval record is auditable, and that "a customer
message or comment must not silently modify an approved baseline." Section 20
requires that a customer-initiated change request never becomes approved scope
automatically. Section 24 lists *proposal acceptance* among the material actions
that should create audit history. Section 15 defines the eventual commercial
gate:

> **Proposal accepted → Agreement completed → Required payment conditions
> satisfied → Project activated**

The requirements are approved product direction. A capability listed in the
requirements is not authorized by appearing there: each capability needs its own
implementation decision. This decision record was written before any
implementation and is now approved.

## 3. Problem

The customer can read the current published proposal and do nothing about it.
There is no way for an authorized customer to say "I accept this" or "I need
these changes", so the commercial workflow stops dead at the read.

The problem is not merely "add two buttons". The hard part is that the response
must be durable, auditable evidence that cannot be mistaken for evidence about a
*different* proposal. A customer looking at version 1 must not be able to
produce a record that reads as acceptance of version 2, and a record must never
be produced by an action the customer did not explicitly take.

Concretely, the design must answer:

1. what exactly is recorded, and does it identify one exact proposal version;
2. what happens when the Founder publishes a newer version between the customer
   opening the page and the customer submitting the response;
3. whether the evidence is an event, a state, or both, and which is the source
   of truth;
4. what happens on repeated requests for changes, and on acceptance after a
   request for changes;
5. who may respond, and in particular whether acceptance is as open as reading;
6. how this is authorized without inventing a second customer permission system;
7. what acceptance does **not** mean, given that agreement, payment, activation,
   and legal effect are all separate, undecided capabilities.

## 4. Goals

1. Let an authorized customer take exactly two explicit actions on the current
   published proposal version: **Request Changes** and **Accept Proposal**.
2. Bind every recorded response to **one exact proposal version**, identified in
   the stored evidence, so "accepted what, when, by whom, for which project" is
   answerable without interpretation.
3. Reuse the existing customer project authorization model unchanged — with
   acceptance restricted to the existing organization Owner/Admin role —
   enforced on the server inside the service boundary.
4. Keep reading a proposal completely non-mutating, with no per-view audit
   event.
5. Keep proposal content, proposal version state, and proposal immutability
   exactly as the Proposal Foundation fixed them: a response never edits,
   replaces, or creates a proposal version.
6. Keep the customer project stage untouched by every action in this slice, and
   leave `customerStageFor` unchanged.
7. Keep the customer projection customer-safe: no internal proposal id, version
   id, capability, or authorization detail is exposed to make responses easier
   to implement.
8. Give the Founder a durable, queryable record of who responded, to which
   version, when, and — for a request for changes — what they asked for.
9. Make duplicate, replayed, concurrent, and stale submissions behave
   deterministically and leave no partial records.
10. Stay small: one new concept, one new table, one new service, one new
    customer endpoint, two new audit-event types.

## 5. Non-goals

Not in this design, not authorized by it, and not implied by it:

- agreement or e-signature of any kind, and any claim of legal validity,
  enforceability, or contractual effect;
- payments, refunds, pricing changes, pricing redesign, currency, tax logic, or
  payment-provider selection;
- automatic project activation, or any change to the activation gate;
- a project-level acceptance or "this project is accepted" commercial state;
- producing the customer-facing *Proposal accepted* stage, or any customer
  project-stage change including *Proposal prepared*;
- customer chat, general project messaging, proposal discussion threads, or
  change-request discussion;
- scope-change approval, scope versioning, or converting a request for changes
  into approved scope;
- creating a new proposal version, a new proposal, or any approved scope change
  as a side effect of a customer response;
- notifications, email workflows, or any provider activation;
- documents, file attachments, or document generation;
- analytics, read receipts, view tracking, or per-view audit events;
- a dedicated retention period, export feature, or project-history export;
- a numeric rate limit specific to this slice;
- AI/LLM features;
- withdrawal or retraction of a published proposal version;
- deployment, hosting, domain, or production configuration changes;
- any new customer JSON **read** endpoint.

Each excluded item requires its own later, separate Founder decision.

## 6. Existing invariants

These are already fixed by accepted decisions and by the current `main`
implementation. This design preserves every one of them.

| # | Invariant | Source |
|---|---|---|
| I1 | A version is customer-visible only when `status = 'published' AND published_at IS NOT NULL`. | Proposal Foundation + Customer Proposal Review; one shared SQL predicate in `sqlite-store.ts` |
| I2 | The current published version is the **highest-numbered** version satisfying I1. A newer `draft` never displaces or hides it. | Customer Proposal Review §5 |
| I3 | `draft` and `published` are the only proposal version statuses. No third state. | Proposal Foundation §4; Customer Proposal Review §5 |
| I4 | Proposal versions are immutable and append-only. There is no update or delete path for a written version. | Proposal Foundation §3 |
| I5 | One proposal per project, enforced by a database unique constraint. | Proposal Foundation §1 |
| I6 | Customer access = existing project authorization: organization Owner/Admin organization-wide; ordinary members by live explicit assignment; revocation immediate; the `founder` capability is never a customer access path. | Customer Platform Foundation; Customer Proposal Review §4 |
| I7 | Authorization is enforced **inside the service**, on every call, against the live access rows — a caller-supplied project id is never trusted as proof of access. | `requireProjectAccess`; the IDOR finding on PR #43 |
| I8 | The customer proposal projection is an explicit field-by-field allow-list. It never spreads a stored record and never carries internal ids, audit metadata, or Founder/internal state. | Customer Proposal Review §6; `views.ts` |
| I9 | Reading a proposal performs no write, creates no audit event, and changes no project stage. No per-view audit event exists. | Customer Proposal Review §9 |
| I10 | Proposal version state, customer-facing project stage, and future commercial/acceptance state are three separate facts. Publishing and viewing never move the stage. | Proposal Foundation §12; Customer Proposal Review §8 |
| I11 | An inaccessible project is indistinguishable from a missing one: `not_found`/`forbidden` both surface as not-found to a customer. | Customer Proposal Review §11 |
| I12 | Audit metadata identifies actor, project, proposal, and version and never copies proposal content. Customer note text never travels through audit history. | Proposal Foundation §7; `internal-views.ts` |
| I13 | Audit events are internal: "Internal: never returned to a customer." | `domain.ts`, `AuditEvent` |
| I14 | State-changing customer requests go through the session-and-origin request guard, redirect back with a short notice code, and never pass a service message through the URL. | `server.ts`, `notices.ts` |
| I15 | Customer-facing lifecycle vocabulary already contains *Proposal prepared* and *Proposal accepted*, but `customerStageFor` today can only produce `project_started`, `intake_information_submitted`, or `intake_review`. | `views.ts`; requirements §7 |
| I16 | `customerStageFor` is not modified by this slice. | This decision, section 11 |

Nothing in this design weakens, re-derives, or works around any of these.

## 7. Proposed response model

Add exactly one new domain concept: the **proposal response** — an explicit,
server-authorized, durably recorded customer action on exactly one published
proposal version.

### 7.1 Source of truth

The source of truth is **append-only `proposal_responses` history**. There is no
mutable project-level or proposal-level response field. A recorded response is
never edited and never deleted. Any "current standing" is **derived** from that
history by a deterministic read, never stored separately, so the two can never
disagree.

### 7.2 What a response identifies

Every response row carries, as a minimum:

| Evidence | Field |
|---|---|
| customer identity | `person_id` |
| organization | `organization_id` |
| project | `project_id` |
| proposal | `proposal_id` |
| exact proposal version | `proposal_version_id` (+ `version_number`) |
| action | `action` |
| timestamp | `created_at` |
| idempotency | `action_key` |
| request-changes text, when applicable | `message` |

This is the complete evidence contract required by requirements §12.

### 7.3 Derived state per proposal version

For a given `(project, proposal, version)`, the derived state follows from the
history alone:

| Derived state | Condition |
|---|---|
| **open** | no response rows exist for the version |
| **changes requested** | at least one `changes_requested` row, no `accepted` row |
| **accepted** | an `accepted` row exists (at most one, by database constraint) |

### 7.4 The rule table

Evaluated server-side inside one transaction:

| Derived version state | Request Changes — any authorized customer with project access | Accept Proposal — organization Owner/Admin only |
|---|---|---|
| open | allowed — appends a row | allowed — appends a row |
| changes requested | allowed — appends a further row | **rejected: this version can no longer be accepted** |
| accepted | **rejected: version is terminal** | **rejected: deterministic "already accepted"** |

Reading down the table: repeated requests for changes are permitted while a
version is open or already in *changes requested*; acceptance is permitted only
while a version is open; and once a version is accepted nothing further can be
recorded against it.

### 7.5 Properties

1. **Two actions only.** `request_changes` and `accept`. No reject, no decline,
   no counter-offer, no comment-only action, no implicit action.
2. **Explicit only.** A response exists only when an authorized customer
   submitted it through the dedicated action. It is never inferred from opening
   the proposal, following the dashboard link, reading for a period of time,
   sending any other message, requesting changes, or any other indirect
   behavior. There is no automatic or default response of any kind.
3. **Version-bound.** Every response names the exact proposal version it applies
   to, by the immutable version row. A response can never refer to "the
   proposal" in the abstract.
4. **Person-scoped rows, version-scoped outcome.** Each row records what one
   acting person did; the derived commercial reading is per version. This
   slice creates **no project-level acceptance state** (section 10).
5. **Append-only.** No update path and no delete path, mirroring how proposal
   versions are handled.
6. **Always bound to the then-current published version.** A response is
   accepted only against the version that is current at submission time
   (section 10), so the stored history can never contain a response against a
   superseded version.
7. **Non-mutating with respect to everything else.** Recording a response does
   not touch proposal content, version status, publication, project stage,
   qualification state, Founder decision, internal notes, intake, or access
   grants.
8. **Read-only viewing is unchanged.** Rendering the proposal page still writes
   nothing and still creates no audit event.

## 8. Request Changes behavior

**Request Changes is an explicit customer action.** It is a control the customer
presses and a form the customer submits. It is never triggered by anything else.

### Who may request changes

Any authorized customer with project access to the project:

- organization **Owner/Admin**;
- **ordinary member** with an active explicit project assignment.

This reuses the existing customer authorization model unchanged. No new role or
permission concept is introduced. Request Changes is deliberately as open as
reading, because it is the customer telling the Founder what needs work — it
creates no commercial commitment.

### Requirements

- the customer must be authorized for the project (section 11);
- the action must target the current published version (section 10);
- the customer must provide a **non-empty message**;
- the message maximum is **5,000 characters after validation** (trimmed);
- the message is stored as part of the **immutable response record**;
- input that is not a string, is empty or whitespace-only after trimming, or
  exceeds the limit is rejected **before persistence** — no partial record;
- the same four conditions — non-null, non-empty after trim, and at most 5,000
  characters for `changes_requested`, and `NULL` for `accepted` — are also
  enforced by the `proposal_responses` CHECK constraint, so the invariant does
  not depend on application validation alone.

### What a request for changes does

- appends one immutable response row identifying the actor, organization,
  project, proposal, proposal version, action, message, timestamp, and
  `action_key`;
- appends one audit event of type `proposal_response.changes_requested` carrying
  the same identifiers **without** the message;
- returns the customer to the proposal page with an approved notice confirming
  the action.

### What a request for changes does **not** do

- does **not** modify proposal content, in any version;
- does **not** modify approved scope, and creates no approved commercial change;
- does **not** change the project stage;
- does **not** create a new proposal version or a new proposal — the Founder
  later decides whether and how to produce another proposal version;
- does **not** imply rejection of the proposal: there is no reject action, and a
  request for changes is neither a decline nor a withdrawal of interest;
- does **not** imply acceptance: recording a message creates no acceptance
  evidence of any kind;
- does **not** change any version's status, or unpublish anything;
- does **not** create an agreement, payment obligation, or activation condition;
- does **not** notify anyone, send email, or open a discussion thread.

A request for changes is a customer request. It is not an approved change. The
requirements are explicit that a customer message must not silently modify an
approved baseline (§19) and that new requests do not become approved scope
automatically (§20); this design implements that literally by giving the message
no write path to anything except its own record.

### Repeated requests

Multiple legitimate Request Changes submissions against the same proposal
version are **allowed**.

- each submission is its own immutable response record — nothing is overwritten
  and earlier customer requests are never silently replaced;
- the `action_key` makes retries and replays of the *same* submission idempotent
  (section 12), so a double-click or a network retry does not create a second
  record;
- no fixed maximum number of requests per version is defined by this ADR;
- the implementation uses the repository's existing request, session, and
  origin protections, and must be structured so a separate abuse or rate-limit
  policy can be added later **without changing the response data model**.

## 9. Acceptance behavior

**Accept Proposal is an explicit customer action** taken on a specific,
displayed proposal version, and it is recorded as such.

### Who may accept

**Only the organization Owner/Admin may accept a proposal.**

An ordinary project member may view the proposal and request changes, but cannot
create the commercial acceptance record.

Reason: acceptance is materially different from ordinary project participation —
it represents the organization's commercial decision on the proposal. Reading
and asking for changes are participation; committing the organization is not.

This does **not** create a new role or permission system. The existing
organization Owner/Admin authorization already present in the platform is
sufficient and is reused as-is (section 11).

### Acceptance requirements

All of the following must hold, server-side, in one transaction:

- a valid authenticated customer session;
- the actor is an **organization Owner/Admin**;
- the actor has project access to the project;
- the targeted proposal version is **still the current published version**
  (section 10);
- no response has yet been recorded against that version (section 7.4);
- the submission carries the server-rendered confirmation the customer completed
  (section 14);
- the submission carries a valid `action_key`.

On success, an immutable acceptance response is recorded with actor,
organization, project, proposal, version, timestamp, and idempotency key, plus
one `proposal_response.accepted` audit event — all in the same transaction.

### What acceptance is

Acceptance is:

> **application-level evidence that an authorized organization representative
> accepted that specific proposal version.**

That is what the record is, and all it is.

### What acceptance is not

- **Not a legal signature.** This design does not create an agreement, does not
  execute or simulate a signature, does not capture consent language,
  intent-to-be-bound, identity verification, seals, evidentiary audit trails, or
  tamper-evidence, and makes **no claim of legal validity**, enforceability, or
  admissibility in any jurisdiction.
- **Agreement/e-signature remains a separate future capability.** Requirements
  §13 places it outside this design with its own undecided requirements
  (identifiable agreement version, signatory identity, signed state,
  immutable/tamper-evident record, secure retention), and states that legal
  validity, provider selection, retention, and jurisdiction-specific
  requirements require separate decisions before production activation.
- **Not the commercial gate.** Acceptance alone does not satisfy the activation
  gate in requirements §15, which also requires a completed agreement and
  satisfied payment conditions.

### What acceptance does not do

- does not change the customer-facing project stage, and in particular does not
  produce *Proposal accepted* (section 11);
- does not create or modify an agreement, contract, or document;
- does not create a payment obligation, schedule, or status;
- does not activate the project or any delivery stage;
- does not modify proposal content or any version;
- does not change service boundaries, scope, or commercial terms;
- does not notify, email, or bill anyone.

### Acceptance after Request Changes — not allowed

A customer must **not** be able to accept a proposal version after Request
Changes has been submitted against that same version. This holds whether the
request came from the same person or another authorized customer.

For that version the workflow is fixed:

> **Request Changes → Founder publishes a new version → customer reviews the
> new version → customer may Request Changes again or Accept.**

The old version can never subsequently become accepted. Attempting it is
rejected with a clear notice and writes nothing.

Reason: this gives the commercial workflow a clean version boundary and avoids
conflicting interpretations of the same proposal — a version the customer has
asked to change must not later read as accepted. It also means a request for
changes is never a dead end: the Founder's existing authoring model already
supplies the next step, because changing what a proposal says means writing the
next immutable version.

### Acceptance terminality

Acceptance is terminal for the specific:

> **`project + proposal + version`**

combination — not per person.

- The **first successful** acceptance creates the one immutable acceptance
  record. The database enforces at most one acceptance row per version, so this
  is a data-integrity guarantee and not merely an application check.
- A **later attempt** to accept the same version creates **no** second
  acceptance record. It returns a deterministic **"already accepted"** result
  consistent with the application's existing platform error and notice
  conventions.
- Once a version is accepted, no further response of any kind may be recorded
  against it.
- A **future newer proposal version is a separate version** and can
  independently be responded to under the same rules.

No project-level `accepted` state is created in this slice (section 10).

## 10. Version binding and stale-version behavior

This is the central correctness question of the design.

### The scenario

1. The customer opens the page and reads published **version 1**.
2. The Founder publishes **version 2**.
3. The customer, still looking at the version-1 page, submits *Accept Proposal*
   or *Request Changes*.

### The rule

A customer response must be submitted against the **exact current published
proposal version the customer is viewing**. The customer submits the
customer-visible **version number** (the only version identifier the accepted
Customer Proposal Review projection exposes — no internal id is revealed for
this purpose).

The server independently **re-derives the current published version** under the
existing invariant

`status = 'published' AND published_at IS NOT NULL`

**inside the same transaction that records the response**, and compares it with
the submitted version number.

**If the submitted version is no longer the current published version: reject
the response and write nothing.**

Explicitly not done:

- **no silent rebinding** to a newer version — that would accept content the
  customer never reviewed;
- **no acceptance of a superseded version** — that could create an acceptance
  for superseded commercial content;
- **no partial response record** — no response row without its audit event, and
  no audit event without its response row.

This applies equally to **Request Changes** and to **Accept Proposal**.

### Why reject rather than bind to the old version

Accepting an older version could create an acceptance for superseded commercial
content while the platform's own current view is the newer version, leaving the
Founder unable to state the customer's position. Silently rebinding would accept
content the customer never reviewed. Rejection is the only option that
preserves both truth and determinism: the customer reloads, sees the current
version, reads it, and responds — which is what the situation calls for.

### Concurrent publication, both orders

| Order | Outcome |
|---|---|
| Response commits first, then the Founder publishes version 2 | The response stands, correctly bound to version 1. Version 2 is a separate version with no responses. |
| Founder publishes version 2 first, then the response commits | The version check fails against version 2. The customer gets a *proposal has been updated* notice. No record. |

Because the derivation, the validation, the writes, and the audit append share
one transaction and the store's write lock, neither order can produce a response
bound to a superseded version, and neither can produce a partial record.

### Drafts

A draft can never be responded to: the server only ever compares against the
current version satisfying I1, and I1 excludes drafts. A form carrying a draft
version number is simply a mismatch and is rejected. No draft existence is ever
revealed — the no-published-version case keeps the existing identical empty
state (I2, I11).

## 11. Authorization

**The existing customer project authorization model, reused unchanged. No second
permission system is introduced.**

### Project access — who may act at all

- **Organization Owner/Admin** may act on any project in their own organization.
- **Ordinary members** may act only on a project with a live explicit
  assignment. Membership in the organization, or in one other project, grants
  nothing here.
- **A revoked assignment** removes the ability immediately, because the existing
  check reads the live `revoked_at` on every call rather than a cached decision.
- **Unauthenticated** requests are refused by the existing session guard before
  any service is reached.

### Action-specific authorization

| Action | Required role |
|---|---|
| Request Changes | any authorized customer with project access (Owner/Admin, or an ordinary member with a live assignment) |
| Accept Proposal | **organization Owner/Admin only** |

An ordinary member who is authorized to read and request changes is rejected for
acceptance. The rejection must not leak anything beyond the fact that the action
was refused, and must not reveal internal proposal or authorization state.

### The Founder capability

The `founder` internal capability is **not** a customer response path. The
response service never consults it. A Founder who is not an authorized customer
of the project is treated exactly like any other unauthorized customer — which
the existing tests already assert for reads. Equally, holding the `founder`
capability does not make an ordinary member an Owner/Admin for acceptance.

### Where it is enforced

Authorization runs **inside the response service, at the top of every method**,
through the existing `requireProjectAccess` path — never only in the route
handler and never delegated to the caller.

This is non-negotiable and it is the direct lesson of PR #43: a project-id
service seam whose authorization was left to the caller was an IDOR. The
accepted fix restored service-level authorization on
`CustomerProposalService.readByProjectId`, and this design requires the same for
every response method. The Owner/Admin check for acceptance is likewise evaluated
inside the service, from the live membership row, on every call.

Each response operation performs, in order:

1. `requireSessionForAction` — origin check, then session check (I14);
2. resolve the customer-facing **reference** to a project id under the existing
   organization-scoped lookup, so an unrelated or revoked project is reported as
   missing rather than disclosed;
3. `requireProjectAccess` **inside the response service** against that id, using
   the current access rows;
4. for acceptance, confirm the live membership role is Owner/Admin;
5. only then derive the current published version and evaluate the response
   rules.

### What must not be accepted as authorization

- a customer-supplied internal project id;
- a customer-supplied internal proposal id or version id;
- a version number alone;
- the fact that the customer can see the page;
- the `founder` capability;
- organization membership by itself for an ordinary member.

A customer-supplied value is used for exactly one thing: the **version number
the customer was shown**, which the server independently re-derives and
compares. It is never used as an identifier lookup and never as proof of access.

### Endpoint shape

One new state-changing customer endpoint, following the existing customer
convention:

`POST /api/projects/{reference}/proposal-response`

It is a form-post endpoint, like `POST /api/projects/{reference}/intake` — not a
JSON API, and not a generic endpoint that accepts arbitrary project or version
identifiers. The reference in the URL is the only resource selector; it is
resolved and authorized server-side. No new customer JSON read endpoint is
added.

## 12. Data model

One new table. Nothing existing is altered: no column is added to `projects`,
`proposals`, or `proposal_versions`, and no proposal invariant is touched.

### `proposal_responses`

```sql
CREATE TABLE IF NOT EXISTS proposal_responses (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  proposal_version_id TEXT NOT NULL REFERENCES proposal_versions(id),
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('changes_requested', 'accepted')),
  message TEXT,
  action_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  -- The message invariant is restated at the database level so it does not
  -- rest on application validation alone: a changes-requested row must carry a
  -- message that is present, non-empty once whitespace is removed, and within
  -- the 5,000 character limit; an accepted row must carry none.
  --
  -- SQLite's trim(X) with no character set strips spaces only, so a message of
  -- tabs or newlines would survive it. The explicit character set (tab, LF, VT,
  -- FF, CR, space) is what makes "whitespace-only" mean here what the
  -- application validator means by it.
  CHECK (
    (action = 'accepted' AND message IS NULL)
    OR (
      action = 'changes_requested'
      AND message IS NOT NULL
      AND length(trim(message, char(9) || char(10) || char(11) || char(12) || char(13) || char(32))) > 0
      AND length(message) <= 5000
    )
  )
);
CREATE INDEX IF NOT EXISTS proposal_responses_by_project
  ON proposal_responses (project_id, created_at);
CREATE INDEX IF NOT EXISTS proposal_responses_by_version
  ON proposal_responses (proposal_version_id);
-- At most one acceptance per proposal version: terminality as a data-integrity
-- guarantee, not merely an application check.
CREATE UNIQUE INDEX IF NOT EXISTS proposal_responses_accepted_once
  ON proposal_responses (proposal_version_id) WHERE action = 'accepted';
```

Append-only: the adapter exposes insert and read, and **no update and no delete
path**, mirroring how proposal versions are handled.

### Field justification

Every field answers a stated requirement. Field names follow the existing domain
conventions (`*_id`, `created_at`, `action`, nullable `message`).

| Field | Why it exists |
|---|---|
| `id` | response id; the record's own identity. |
| `person_id` | customer identity (requirements §12). |
| `organization_id` | organization (requirements §12); matches how `AuditEvent` already carries `organizationId`. |
| `project_id` | project (requirements §12). |
| `proposal_id` | proposal (requirements §12). |
| `proposal_version_id` | the exact proposal version — the binding this whole design exists to guarantee. Because proposal versions are globally unique and immutable, this is the exact version identity. |
| `version_number` | the customer-meaningful version identifier established by the accepted Customer Proposal Review decision, so "which version" is answerable without a join. Denormalized from an immutable, append-only, per-proposal-unique value, so it cannot drift. |
| `action` | `changes_requested` or `accepted`. |
| `message` | required, non-null, non-empty once whitespace is removed, and at most 5,000 characters for `changes_requested`; `NULL` for `accepted`. All four conditions are enforced by the table's CHECK constraint, not only by application validation. Holds the customer's request text at the 5,000-character cap. |
| `action_key` | idempotency key. |
| `created_at` | submitted/occurred timestamp. |

Explicitly **not** present, because each would invent a capability excluded by
section 5: price, amount, currency, pricing state, payment status, payment
schedule, agreement status, signature or legal fields, activation state,
notification state, messaging/thread fields, scope-change fields, or a
project-level acceptance flag.

### Idempotency and abuse protection

- `action_key` is **required** for every customer response submission. It
  prevents accidental duplicate creation when the same submission is retried: a
  retry or replay of one submission hits `UNIQUE(action_key)` and is treated as
  the already-recorded result rather than a second record, and writes no second
  audit event.
- Malformed input and excessive message length are rejected **before
  persistence**, so no partial or oversized record is ever written. The
  `proposal_responses` CHECK constraint is the second line of defence: it
  rejects a `changes_requested` row whose message is null, empty or
  whitespace-only, or longer than 5,000 characters, and an `accepted` row that
  carries a message at all. Application validation remains the primary gate — it
  trims with JavaScript semantics, which also cover Unicode whitespace such as
  non-breaking spaces that the SQL expression does not reach, and it reports the
  customer-facing notice — while the constraint is what makes the rule hold for
  a write that reaches the store by any other path.
- **No numeric rate limit is defined by this ADR.** The implementation retains
  the ability to add platform-level rate limiting or abuse protection
  independently, using the existing `consumeRateLimit` seam, without changing
  the response data model or the evidence contract.

### Concurrency

All of the following happen inside **one** `transaction()` call, so they are
all-or-nothing:

1. authorization (project access, and Owner/Admin for acceptance);
2. re-derivation of the current published version under I1;
3. stale-version validation against the submitted version number;
4. validation of the action against the derived version state (section 7.4);
5. validation of the `action_key` for idempotency;
6. write of the response row;
7. write of the corresponding audit event.

Consequences:

- **Two concurrent actions cannot produce two successful acceptances for the
  same project/proposal/version.** The transaction serializes on the store's
  write lock, the second sees the existing acceptance, and the partial unique
  index on `proposal_version_id WHERE action = 'accepted'` is the final
  integrity guard — exactly the pattern the Proposal Foundation uses for
  `UNIQUE(project_id)`.
- **A concurrent newer publication cannot let an action submitted against an
  older version slip through**, because the current-version derivation happens
  inside the same transaction that writes, after the write lock is held.
- A failed audit append rolls back the response row, and vice versa, so a
  response can never exist without its audit event.

### Store port and service boundary

Store port additions, in the existing `PlatformStore` style:

- `createProposalResponse(input) → ProposalResponseInternal`
- `listProposalResponses(projectId) → ProposalResponseInternal[]`
- `findProposalResponseByKey(actionKey) → ProposalResponseInternal | null`
- `findAcceptedProposalVersion(proposalVersionId) → ProposalResponseInternal | null`

A **new service** — `CustomerProposalResponseService`, exposed as
`platform.customerProposalResponses` — rather than adding write methods to
`CustomerProposalService`.

Reason: `customer-proposals.ts` documents itself as the single read-only seam
that "exposes exactly one fact", and PR #43's review established that its
authorization contract must stay intact. Widening a documented read-only seam
into a read-write seam would change that contract and mix a commercial write
into a projection-boundary module. A sibling service keeps both contracts
precise, shares `requireProjectAccess`, and keeps business rules out of the
Next.js route — consistent with how `ProposalService`,
`FounderWorkspaceService`, `IntakeService`, and `ProjectService` are separated
today.

## 13. Audit and evidence model

### Two layers, one transaction, different jobs

**Layer 1 — the response record is the primary evidence.** The
`proposal_responses` row is the durable, application-level record of what
happened, and the only place a customer's request-for-changes message is stored.
It is immutable and indexed for the exact query *"who accepted which proposal
version, for which project, and when?"*

**Layer 2 — internal audit events.** Each recorded response also appends an
`AuditEvent`, so responses appear in the existing project audit history the
Founder workspace already renders, which requirements §24 lists as the place
*proposal acceptance* belongs. Two new `AuditEventType` values, following the
existing per-action naming precedent (`proposal_version.created` /
`proposal_version.published`):

- `proposal_response.accepted`
- `proposal_response.changes_requested`

### Audit metadata rule

The audit metadata contains **identifiers only**:

```ts
{ proposalId, proposalVersionId, versionNumber, action }
```

It **must not** copy the customer message. The response row remains the durable
record containing the message and the action details (I12, and the reason
`internal-views.ts` deliberately keeps note text out of audit history).

Both layers are written in the same transaction, so an audit event can never
exist without its response row, or the reverse.

### Deliberately absent

- **No per-view or read-receipt event.** Customer viewing remains non-mutating
  and produces no view audit event (I9). The Customer Proposal Review
  decision's explicit rejection of view auditing is reaffirmed here.
- **No proposal-content copies.** Neither the response record nor the audit
  event duplicates proposal text.
- **No stage-change event**, because no stage changes.

### Evidence retention

Response records are kept as part of the project's durable history for as long
as the project history itself is retained.

- **No separate custom retention period** is required by this ADR.
- **No special export feature** is required in this slice.
- The model — flat, self-describing rows keyed by project, proposal, version,
  person, organization, action, and timestamp — remains suitable for a future
  project-history or export capability without restructuring.

## 14. Customer UI behavior

No UI is implemented by this decision. This section defines the minimum behavior
the eventual implementation must have, evaluated against the portal's actual
conventions rather than assumed.

### Existing portal conventions, as found

- server-rendered pages, no client-side form JavaScript (the only client
  component in the app is the theme menu; forms are plain `<form method="post">`);
- one form per action area with named `intent` submit buttons, as on the intake
  page and the internal proposal page;
- handlers redirect back to the page with a short query parameter, and
  `notices.ts` is the single place those codes become approved wording;
- `searchParams` are already read by the proposal page's neighbours to render
  notices;
- there is **no existing confirmation pattern anywhere in the portal**, so one
  must be designed rather than reused.

### Request Changes — minimum UX

- show the customer that they are submitting a **change request against the
  displayed proposal version** (state the version number);
- **require the change-request message** in a labelled textarea;
- **require an explicit submit action**;
- state that requesting changes does not change the proposal and does not
  accept or reject it.

### Accept Proposal — minimum UX

Before submission, show a **confirmation state** containing at least:

- **project context** (project reference and title);
- the **proposal version number**;
- a clear statement that the customer is accepting **that specific proposal
  version**;
- an **explicit final confirmation action**;
- a plain *Cancel* control returning to the proposal.

Also required:

- name the version number **and** its publication date in the confirmation, so
  the customer can see exactly what they are accepting;
- state the reversibility rule before the action: within this version the
  response is final and a change of mind requires the Founder to publish the
  next proposal version.

Deliberately **not** required or permitted:

- **no e-signature** of any kind;
- the button must **not** be presented as a legally binding signature;
- **no unnecessary checkboxes**, no consent-tick furniture, and no legal
  language the business has not approved.

Because the portal has no client-side confirmation convention, the smallest
consistent mechanism is a query-parameter-driven confirmation panel rendered by
the same server component — the pattern `searchParams` already serves on these
pages. No `window.confirm`, no client script, no new client component.

### Copy obligations

The UI must make each of these unmistakable:

- **Request Changes does not change the proposal** and does not accept or reject
  it;
- **Accept applies to a specific proposal version**, named in the confirmation;
- **acceptance is an explicit action**, never implied by viewing, navigating, or
  waiting;
- **only an Owner/Admin can accept** — an ordinary member must not be shown an
  accept control they cannot use;
- **no legal claim**: copy must not say "sign", "legally binding", "contract",
  or anything implying legal effect.

### Customer visibility of their own response

The customer should be able to see the standing for the proposal version they
responded to.

- It is **derived from the immutable response history**, never copied back onto
  the proposal record.
- **No separate mutable "customer status" column** is created on the proposal,
  on the version, or on the project.
- The exact UI projection — inline versus panel, wording, ordering — is
  implemented in the later coding task; this ADR fixes only the derivation
  source.

The page must **not** show other people's responses, any Founder/internal
identity, any internal id or capability, any draft or hint that a draft exists,
or anything at all when no published version exists — the existing identical
empty state is preserved unchanged.

### Unchanged

The proposal read stays read-only. Rendering the page still writes nothing and
creates no audit event.

## 15. Founder visibility

**Designed here; not implemented by this decision.** No Founder UI change is in
scope for this task.

The data model is chosen so the eventual Founder surface is a pure read.

The Founder must eventually be able to see, for a project:

- the **customer identity** who acted;
- the **organization**;
- the **project**;
- the **proposal version**;
- the **action** taken;
- the **timestamp**;
- the **request-change message**, where one exists.

All seven come straight from `proposal_responses` with no new derivation.

### Fit with the existing Founder workspace

- The natural home is the existing internal proposal surface
  `/internal/projects/{reference}/proposal`, or the project review page — both
  already Founder-capability-gated, both already render version and audit
  history. The response list is a new section, not a new route tree.
- It must be built in `internal-views.ts` style: constructed key by key from an
  explicit list, never spreading a stored record, so a column added later cannot
  reach the Founder view by accident.
- Authorization is the existing `founder` capability via
  `resolveProjectId`/`requireFounderWithBootstrap`, never organization
  membership — and never the reverse direction either: the customer response
  path must not consult it.
- The two new audit types appear automatically in the existing project audit
  history (section 13), so the Founder gets an at-a-glance trace immediately
  even before any dedicated response list exists.
- The customer's message must be rendered as escaped text only. It is
  customer-supplied content of bounded length, and it must never be interpreted
  as markup or as an instruction.
- Responses must be listed per version with **all** entries visible, not only
  the latest, so a version's request history is not hidden behind its most
  recent entry.

## 16. Error and failure semantics

Reuses the existing error and notice conventions; no new error mechanism.

| Situation | Behaviour | Record written? |
|---|---|---|
| Unauthenticated request | Existing redirect to sign-in preserving `returnTo` | No |
| Cross-origin submission | Existing origin rejection → `origin-denied` notice | No |
| Project in another organization | Not found (`not_found`), indistinguishable from missing | No |
| Invalid/nonexistent reference | Not found | No |
| Ordinary member without a live assignment | Not found | No |
| Assignment revoked | Not found / forbidden on the next call | No |
| Founder capability held, but no customer access | Treated as unauthorized — no access | No |
| **Ordinary member attempts Accept Proposal** | Refused under the existing error convention; no acceptance created | No |
| No proposal at all | Not found for the POST; the page keeps its empty state | No |
| Drafts only | Identical to "no proposal"; draft existence never revealed | No |
| Submitted version ≠ current published version | Distinct notice: *the proposal has been updated — review the latest version* | **No** |
| Submitted version number malformed (non-integer, <1) | Validation notice | No |
| Replayed/double-submitted `action_key` | Idempotent: returns the already-recorded result as success | No second row, no second audit event |
| **Accept attempted on a version already accepted** | Deterministic **"already accepted"** result via the existing platform error and notice conventions | No |
| **Accept attempted after Request Changes on that version** | Rejected with a clear notice; the version is no longer acceptable | No |
| **Any response attempted on an accepted version** | Rejected; version is terminal | No |
| Empty/oversized/non-string message | Validation notice, rejected before persistence | No |
| Response written, audit append fails | Whole transaction rolls back | No partial record |
| Two concurrent acceptances, same version | Serialized; second observes the existing acceptance and returns "already accepted" | One acceptance |
| Concurrent Founder publication | See section 10 — both orders safe | Deterministic |
| Unexpected internal failure | Re-thrown, not shown to the customer | Nothing partial |

Notice codes follow the existing `{prefix}-denied` / `{prefix}-rate-limited`
shape produced by `redirectAfterError`. Distinct customer-safe outcomes require
distinct approved codes in `notices.ts` (for example `proposal-updated`,
`proposal-response-denied`, `proposal-response-invalid`,
`proposal-response-accepted`); the handler must branch on the stable platform
error **code** and must never pass a service message, token, session identifier,
or internal state through a redirect (I14).

Customer-supplied text is bounded at write time (section 8), so no truncation or
retention policy is needed later.

## 17. Testing and verification contract

Acceptance criteria for the eventual implementation. As with the preceding
slices, these must run against the **real services, real SQL, and the real
authorization helpers**, with only time and the email transport controlled.

### Authorization
- an unauthenticated response request is rejected;
- an authenticated customer without project access is rejected, and is shown as
  not found rather than forbidden;
- an ordinary member without an explicit assignment cannot respond;
- an ordinary member **with** a live assignment **can request changes**;
- an ordinary member **cannot accept**, even with full project access;
- an organization Owner/Admin can request changes and can accept on a project in
  their own organization;
- an organization Owner/Admin **cannot** respond on a project in another
  organization;
- the `founder` internal capability does not grant customer response access, and
  does not let an ordinary member accept;
- passing an internal project id the caller was never granted is rejected **by
  the service**, not by the route (the PR #43 IDOR regression, restated for this
  service);
- authorization is re-evaluated on every call: revoking an assignment between
  two submissions blocks the second.

### Version binding
- a recorded response identifies the exact proposal version (assert the stored
  `proposal_version_id` and `version_number`);
- a response can never be recorded against a draft;
- a response submitted with a superseded version number is rejected with the
  *proposal updated* notice and writes nothing — for **both** actions;
- when the Founder publishes version 2, a response submitted against version 1
  fails, and a response submitted after reload is recorded against version 2;
- version 2 starts with no responses: an older version's responses are never
  inherited by, or displayed against, a newer version;
- the concurrent-publication order in section 10 is exercised in both orders;
- no response row exists whose `proposal_version_id` is not the current
  published version at the time it was written.

### Request Changes
- the action is explicit: no code path derives a response from viewing,
  navigating, or inactivity;
- message validation: missing, whitespace-only, non-string, and over-5,000 input
  are all rejected before persistence with no record written;
- a recorded request for changes creates exactly one immutable row;
- a request for changes modifies no proposal content and no version in any way;
- a request for changes modifies no approved scope;
- a request for changes creates no new proposal version;
- a request for changes changes no customer-facing project stage (assert
  `customerStageFor` output is byte-identical before and after);
- a request for changes writes no message into audit metadata;
- a request for changes creates no acceptance evidence of any kind;
- repeated requests for changes on the same version are **each** recorded, in
  order, and earlier records are unchanged;
- retrying the same submission is idempotent: one row, one audit event;
- no fixed maximum number of requests per version is enforced by this slice.

### Acceptance
- the action is explicit and requires the dedicated submission plus the
  confirmation step;
- acceptance is refused for an ordinary member and allowed for an Owner/Admin;
- the accepted version is recorded with actor, organization, project, proposal,
  version, and timestamp — assert every field of the evidence contract;
- duplicate or replayed submission of the same `action_key` is a no-op: one row,
  one audit event;
- a **second** acceptance attempt on the same version returns a deterministic
  *already accepted* result and creates no second record;
- acceptance after a request for changes **on the same version is rejected** and
  writes nothing;
- a request for changes after a version is accepted is rejected;
- a newer published version is independently acceptable: the prior version's
  state does not block it;
- acceptance changes no project stage, creates no agreement, no payment state,
  and no activation;
- acceptance is never attributed to a different project or version than the one
  submitted against.

### State preservation and boundary
- viewing the proposal still performs no write and creates no audit event;
- the customer proposal projection still contains exactly the approved
  allow-list — no internal id is added to make responses easier;
- no response is recorded without its audit event, and no audit event exists
  without its response row (force a failure between the two writes);
- no unrelated proposal, version, project, intake, access, or internal state is
  modified by any response;
- a customer response cannot be read or written through the Founder-only
  endpoint, and a customer session cannot reach internal routes by changing the
  URL, query, or body;
- the two new audit types carry no proposal content and no customer message;
- `customerStageFor` is unchanged and produces no `proposal_accepted` stage.

### Non-regression
- every existing Proposal Foundation and Customer Proposal Review test still
  passes unchanged;
- the `hasPublishedProposal` dashboard signal is unchanged by responses;
- reading, publishing, versioning, and authorization behaviour are untouched.

## 18. Alternatives considered

### 1. Immutable response event/history *(chosen, with derived state)*
Chosen as the source of truth. One append-only table; "current standing" is a
deterministic read of that history. History is preserved, there is no second
copy to drift, and the evidence contract is satisfied by the row itself.

### 2. One current response state per proposal version *(rejected)*
A single mutable row would lose history the requirements ask for, could not
represent repeated requests for changes without overwriting an earlier one, and
would be a mutable source of truth for a commercial record.

### 3. Combined stored state plus immutable history *(rejected)*
Two stores answering one question is two sources of truth that can disagree,
plus a reconciliation rule that must itself be tested. The derived read gives
the same convenience for free. Project-level acceptance state is explicitly out
of scope (section 10), so there is nothing that needs storing separately.

### 4. Responses only through the currently published version *(chosen)*
Chosen for the reason given in section 10: it is the only option that prevents
both an acceptance of content the customer never read and a durable record
against a superseded version.

### 5. Accepting a specific version even when a newer one exists *(rejected)*
Truthful about what the customer read, but it manufactures exactly the ambiguous
commercial state this design avoids — an acceptance for a version the platform no
longer presents as current.

### 6a. Request changes as a plain customer message *(chosen)*
A single required free-text field is the minimum useful payload and needs no new
concept beyond the response row itself.

### 6b. A dedicated change-request record *(rejected for now)*
A separate `change_requests` entity with classification, status, and disposition
would pre-empt requirements §20 (defect vs out-of-scope, Founder disposition) and
requirements §17 (scope versioning), both separate, undecided capabilities. The
message lives on the response row and can be promoted to its own entity later
without losing anything: who asked, when, and for which version is already
durable.

### Also considered and rejected

- **Acceptance as an audit event only.** Audit events are internal-only (I13),
  but the customer must see their own standing; a record is unavoidable.
- **Acceptance open to any customer with project access.** Rejected: acceptance
  represents the organization's commercial decision, so it is restricted to the
  existing Owner/Admin role while Request Changes stays open to anyone with
  project access. This reuses an existing role rather than creating one.
- **Allowing acceptance after Request Changes on the same version.** Rejected:
  it produces conflicting interpretations of one proposal version. The clean
  version boundary — request changes, then the Founder publishes the next
  version — matches the Proposal Foundation's own "changing what a proposal says
  means writing the next version" rule.
- **Project-level acceptance state now.** Rejected: it would be a commercial
  state entangled with agreement, payment, and activation, all excluded here.
- **Producing the *Proposal accepted* stage now.** Rejected: `customerStageFor`
  cannot produce it today (I15), so producing it means changing the
  stage-derivation rule — a separate future lifecycle decision.
- **Binding the response by internal version id.** Rejected: it would expose an
  internal id to the customer, violating the accepted projection boundary for no
  gain. The customer submits the visible version number instead.
- **Removing or bypassing service-level authorization to avoid a repeated
  check.** Rejected outright: PR #43's IDOR demonstrated exactly why the service
  must not trust its caller.
- **A fixed maximum number of requests for changes.** Rejected: no legitimate
  business need justifies an arbitrary cap, and none is invented here.
- **A numeric rate limit specific to this slice.** Deferred: platform-level
  protection can be added independently without changing the data model.
- **A custom retention period or export feature.** Deferred: records live with
  project history until a retention/export decision exists.

## 19. Consequences

**Positive.** The commercial workflow gains its first real step: an authorized
customer can commit an organization to a published proposal or ask for changes,
and the platform holds durable, version-bound evidence of exactly that. Every
response is provably about the version the customer was shown, which is the
property that makes the record worth having. Restricting acceptance to
Owner/Admin draws a clean line between participating in a project and committing
the organization commercially, using a role that already exists. The Founder can
see what the customer did, on which version, when, and — for a request for
changes — what they wanted, from a read that needs no new permission model.

**Costs and risks, stated plainly.**

- One more append-only table and one more service to keep separate from the read
  seam and from the Founder authoring service.
- The rule table in section 7.4 becomes a commercial invariant that must not be
  weakened silently; it is covered by the testing contract, but it is a rule the
  Founder should know is there.
- **A version that has been requested to change can never be accepted.** This is
  deliberate, and it means the only route out is the Founder publishing the next
  version. If the Founder ever wants to accept a version that was already
  requested to change, that requires a new decision — it cannot be done quietly.
- **Acceptance is terminal per version.** The first Owner/Admin acceptance is
  final for that version; a mistaken acceptance can only be revisited by
  publishing the next version.
- The design intentionally leaves the project with **no** project-level
  "accepted" state, so nothing downstream (agreement, payment, activation) can
  consume yet. That is correct for this slice but means the commercial gate
  remains conceptually incomplete until a later decision.
- The customer's request-for-changes text is durable customer-supplied content.
  It is length-bounded, identifier-only in audit metadata, and rendered as text
  only, but it does enter the data store and will need to respect the
  repository's non-disclosure rules when any live data exists.

**No effect on:** proposal immutability, publication semantics, the customer
projection, customer project access rules, the customer project stage, or
reading behaviour.

## 20. Open questions requiring Founder decision

**None. No additional Founder business decision is required for this
implementation slice.**

Every business question this design raised has been decided and recorded above:
the response model and its source of truth (section 7), version binding and the
stale-version rule (section 10), the Request Changes payload and its 5,000
character limit (section 8), repeated requests (section 8), who may request
changes and who may accept (sections 8, 9, 11), acceptance semantics and its
application-level, non-legal character (section 9), acceptance after request
changes (section 9), acceptance terminality (section 9), project-level
acceptance state (section 10), the customer-facing *Proposal accepted* stage
(section 11), confirmation UX (section 14), audit and evidence (section 13),
evidence retention (section 13), idempotency and abuse protection (section 12),
concurrency (section 12), the data model (section 12), customer visibility of
their own response (section 14), and Founder visibility (section 15).

The following are **implementation-level** details for the coding task. They do
not change the design, the evidence contract, or any business rule, and none
requires a further Founder decision:

1. exact customer-facing wording of the two actions, the confirmation copy, and
   the notice messages — subject to the copy obligations in section 14 and to
   using no unapproved legal language;
2. whether the Accept confirmation is a separate query-parameter panel or an
   inline fieldset — both satisfy section 14;
3. the exact notice codes and their approved wording in `notices.ts`;
4. store/port method names, index choices, and query tuning within the model in
   section 12;
5. whether the customer's own standing is rendered inline or as a panel, and
   its exact projection shape — derived from response history either way;
6. repository-level rate limiting policy for customer state-changing endpoints
   generally, which can be added later without changing the response data model.

## 21. Approval

**Status: Accepted and implemented. Founder approval: Approved 2026-10-06.**

The Founder approved this design on 2026-10-06. That approval is recorded in
this repository, which is the sole system of record.

Approval covers the design as written, including:

- append-only `proposal_responses` history as the sole source of truth, with
  current standing derived from it and no mutable project-level response field
  (section 7);
- binding every response to the exact current published version, with the
  customer submitting the visible version number and the server re-deriving the
  current version under `status = 'published' AND published_at IS NOT NULL`
  inside the recording transaction (section 10);
- the stale-version rule: reject and write nothing — no silent rebinding, no
  superseded-version acceptance, no partial record — for both actions
  (section 10);
- Request Changes requirements, including the required non-empty message and its
  5,000 character maximum, and what the action explicitly does not do
  (section 8);
- repeated Request Changes being allowed and immutable, with `action_key`
  idempotency, no invented maximum, and no numeric rate limit in this ADR
  (sections 8, 12);
- Request Changes being open to any authorized customer with project access
  (section 8);
- **Accept Proposal being restricted to the organization Owner/Admin**, reusing
  existing authorization with no new role (sections 9, 11);
- acceptance as **application-level evidence only**, explicitly not a legal
  signature and carrying no claim of legal validity, with agreement/e-signature
  remaining a separate future capability (section 9);
- acceptance being disallowed after Request Changes against the same version,
  and the fixed workflow *Request Changes → Founder publishes a new version →
  review → Request Changes again or Accept* (section 9);
- acceptance terminality for `project + proposal + version`, with the first
  success creating the one record and later attempts returning a deterministic
  "already accepted" result (section 9);
- no project-level acceptance state and no change to `customerStageFor` or the
  customer-facing *Proposal accepted* stage (sections 10, 11);
- the minimum confirmation UX for both actions, with no e-signature, no
  signature-pretending button, and no unapproved checkboxes or legal language
  (section 14);
- the two-layer evidence model: `proposal_responses` as primary evidence plus
  `proposal_response.accepted` and `proposal_response.changes_requested` audit
  events carrying identifiers only and never the customer message, with viewing
  remaining non-mutating (section 13);
- evidence retention as part of project history, with no separate retention
  period and no export feature in this slice (section 13);
- the minimal data model and its exclusion of pricing, currency, agreement,
  payment, legal signature, activation, notification, and messaging fields
  (section 12);
- the transaction and concurrency requirements, including that two concurrent
  actions cannot both succeed as acceptances (section 12).

**Design accepted on 2026-10-06; implementation completed and merged in PR #45
(merge commit `d9c95f265393197878fe55a5820a26e00e8fe0a9`).**

Approval of this design authorized the implementation, which was carried out as a
separate, later task against the verification contract in section 17, and the
result is now part of `main`. Implementation does **not** mean the capability is
deployed: the slice is not activated for live customers and has processed no live
customer data.

Approval and implementation of this design do not authorize production
deployment, live customer-data operation, or provider activation, and they do not
authorize any capability listed in section 5 — agreement/e-signature, payments,
activation, messaging, notifications, documents, analytics, AI/LLM, or any
customer project-stage change — each of which requires its own later decision.
