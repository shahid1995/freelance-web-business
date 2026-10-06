# Customer Proposal Review

**Status:** Proposed  
**Date:** 2026-10-06  
**Founder approval:** Pending  
**Scope:** Smallest customer-facing read slice for a published proposal — visibility only, no review actions  
**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation, Founder/Internal Workspace and Project Intake Review, Founder Project Queue, Proposal Foundation

> **Status note.** This decision is **Proposed**. It is not in force until the
> Founder explicitly approves it, and no implementation may begin before then. It
> defines only a read boundary through which an authorized customer can view the
> current published proposal for their own project. It does not authorize
> proposal review actions, request changes, acceptance, agreement/e-signature,
> payments, automatic activation, notifications, deployment, or any other
> external action.

## 1. Context

The Proposal Foundation (`docs/decisions/2026-10-05-proposal-foundation.md`,
Status: Accepted) gives the Founder a durable, versioned proposal record: one
proposal per project, immutable numbered versions, a `draft`/`published` version
status, Founder-only authoring, and an explicit, audited publication act.

That slice deliberately stops at the internal boundary. It adds no customer
proposal route, no customer projection that reads a proposal, and no customer
visibility at all. A published version is "available for a future customer
workflow", but the customer cannot yet see it, and the Proposal Foundation
records that publishing does **not** mean the customer has seen or accepted
anything.

The customer-platform requirements
(`docs/website/customer-platform-requirements.md`) describe the eventual
customer-facing proposal workflow:

> Qualified opportunity → Proposal → Customer review → Request changes or accept

and define the customer timeline stages *Proposal prepared*, *Proposal accepted*,
*Agreement completed*, and *Payment satisfied*, with proposal versions remaining
identifiable and acceptance recording enough evidence to identify the customer,
organization, project, proposal version, acceptance action, and date/time.

The requirements are approved as product direction. Separating "the requirements
describe this" from "this capability is approved to build" matters: a capability
listed in the requirements is not authorized by its presence there, and each
future capability needs its own implementation decision.

This document is the smallest step between the Proposal Foundation and that
eventual workflow. It makes a published proposal **visible** to the authorized
customer for their own project. It deliberately does not implement review,
request changes, or acceptance.

## 2. Decision

Add a read-only, customer-safe view of the **current published proposal version**
for a project the customer is already authorized to access, and nothing else.

Concretely:

1. **Visibility is driven by the existing `published` version state.** No second
   publication concept is introduced. A proposal is customer-visible if and only
   if it has at least one version whose status is `published`.
2. **Only the current published version is customer-visible.** Drafts remain
   Founder-only and are never customer-visible, whatever their version number.
3. **Customer access reuses the existing project authorization model.** No new
   permission concept is introduced. A customer may read a proposal only where
   the existing rules already let them access the project.
4. **A customer-safe projection is built field by field.** It carries only the
   proposal content the customer is meant to see, and never internal state.
5. **The slice adds one server-rendered customer route and one customer-safe
   read path.** There is no customer write, no customer JSON mutation, and no
   mutation of any proposal record.
6. **Reading changes nothing.** Viewing a proposal does not change proposal
   state, does not change the customer-facing project stage, and does not create
   a second copy of the proposal.
7. **Visibility does not imply acceptance.** The customer can see a published
   proposal; they have not accepted, agreed, or been bound to anything, and the
   system records no acceptance.

## 3. Customer visibility

Visibility is the existing Proposal Foundation publication state and nothing
more.

- A version is customer-visible **only** when its stored status is `published`.
- A `draft` version is Founder-only and must never appear in any customer
  response, projection, or page, even when it is the newest version.
- Publishing remains the explicit, Founder-only, audited act already defined by
  the Proposal Foundation. This document does **not** add, rename, or split a
  publication step; it only lets the customer read the result.
- **Customer visibility does not imply acceptance.** Publishing does not mean the
  customer has seen the proposal, and reading it does not mean they accepted it.
  There is no agreement, no binding commitment, and no recorded acceptance in
  this slice.

A proposal that has no published version (no proposal at all, or only drafts) is
simply not visible. The customer cannot distinguish those two cases, and the
system must not help them do so.

## 4. Customer authorization

Customer proposal access reuses the existing project-specific authorization
model unchanged. This slice introduces no new roles, capabilities, or permission
subsystem.

- **Organization Owner/Admin** retain organization-wide project access, exactly
  as the Customer Platform Foundation decision defines: they may read the
  published proposal for any project in their own organization.
- **Ordinary members** may read a proposal only for a project they have been
  explicitly assigned. Membership in the organization, or in one project, must
  not grant access to another project's proposal.
- A revoked project assignment removes proposal access immediately, because the
  existing access check reads the live grant on every call.

The slice explicitly prevents:

- one customer reading another project's proposal, including a different
  project in the same organization that they are not assigned to;
- an ordinary member using organization membership to bypass project-specific
  access;
- unauthenticated access;
- any internal (Founder-only) state appearing in a customer response.

The `founder` internal capability is **not** a customer access path. Holding it
grants nothing on the customer route, and the customer route never consults it;
a Founder who is not an authorized customer of the project is treated exactly
like any other unauthorized customer.

## 5. Published-version selection

The customer sees exactly one version: the **current published version**, defined
as the highest-numbered version whose status is `published`. This matches the
Proposal Foundation's own semantics, where historical versions remain readable
internally and publication is explicit.

Behavior for each case:

| Case | Customer result |
|---|---|
| No proposal exists | Nothing visible — empty state |
| Proposal exists, all versions are `draft` | Nothing visible — same empty state |
| A `published` version exists | The highest-numbered `published` version is visible |
| A newer `draft` exists after a `published` version | The published version stays visible; the newer draft stays hidden |
| Several `published` versions exist | The highest-numbered published version is the current one |

Rules:

- A **draft must never become visible** merely because it is newer or because a
  later published version exists.
- An **older published version must never** be presented as the customer's
  current proposal when a newer published version exists. Older versions remain
  readable internally, as the Proposal Foundation requires; they are not the
  customer's current view.
- The choice of "current published version" lives in the service/store layer,
  not in the UI, so the page cannot disagree with the internal projection about
  which version is current.

## 6. Customer projection

The slice adds an explicit, customer-safe projection, built field by field from
an allow-list, in the same style as the existing customer projections in
`website/lib/platform/views.ts`. It never spreads a stored record, so a column
added to a proposal or version record later cannot reach a customer response by
accident.

The projection carries, at most:

- the project reference (the customer-visible project identifier);
- the proposal version number;
- the version's publication timestamp;
- the version's proposal content:
  - `summary`
  - `scopeIncluded`
  - `scopeExcluded`
  - `deliverables`
  - `timeline`
  - `assumptions`
  - `commercialTerms` (the Founder-approved free text already stored; no new
    commercial policy is invented here)
  - optional `validUntil`

The projection must **not** contain:

- internal audit metadata or audit identifiers;
- Founder capability, identity, or access information;
- qualification state, Founder decision, internal notes, or internal next
  action;
- any unpublished draft, or any hint that a draft exists;
- internal identifiers that are not necessary for the customer (for example the
  internal proposal id or version id);
- authentication or session material.

The version number is included deliberately: the requirements state that
proposal versions must remain identifiable, and the version number is the
customer-meaningful identifier. The opaque internal ids are not needed for that
and are excluded.

## 7. Customer UI

The slice adds one read-only, server-rendered customer route:

`/dashboard/projects/{reference}/proposal`

This follows the existing customer route shape
(`/dashboard/projects/{reference}/intake`) and is scoped to the project, because
there is at most one proposal per project.

The page:

- requires a valid customer session through the existing page request guard and
  renders `not found` for a project the customer cannot access (see section 11);
- displays the project context (reference and title);
- displays the current published version with a neutral label such as
  *Proposal — published <date>*;
- renders the projection's content sections with readable labels;
- contains **no** forms and **no** state-changing controls.

The page must not display, in this slice:

- chat or comments;
- request-changes controls;
- acceptance controls;
- agreement/signing controls;
- payment controls;
- any control or copy that implies the customer can accept, reject, or be bound
  by the proposal.

Discoverability: the customer dashboard's project entry gains a minimal,
customer-safe signal — a boolean such as `hasPublishedProposal` — and shows a
link to the proposal page only when it is true. The boolean must be `false` when
there is no proposal and when there are only drafts, so it cannot reveal that a
draft exists. No other field is added to the existing customer project
projection.

## 8. Project-stage separation

Three distinct facts remain separate and must not be conflated:

- **Proposal version state** — `draft` or `published`. An internal version fact.
- **Customer-facing project stage** — the approved customer timeline vocabulary
  already produced by the platform (`customerStageFor`); internal qualification
  and decisions can never influence it.
- **Future proposal acceptance state** — not implemented by this slice.

This slice does **not** change the customer-facing project stage at all.

- Publishing a version still does **not** move the project stage, consistent
  with the accepted Proposal Foundation decision.
- Reading the proposal does **not** move the project stage.
- The customer will not see a stage transition merely because a proposal became
  visible or was opened.

The reserved `Proposal prepared` stage is **not** produced by this slice.
Whether the customer timeline should eventually reflect a prepared proposal is a
separate, later decision, because producing that stage would change the existing
stage-derivation rule and the publication semantics fixed by the Proposal
Foundation. Deciding that here would silently widen this slice.

No state transition is introduced by this document: not on publish (publication
semantics are already fixed), and not on view.

## 9. Auditability

- **Publication** is already audited by the Proposal Foundation
  (`proposal_version.published`). This slice changes nothing about it and adds no
  new publication event.
- **Customer viewing is not audited in this slice.** Reading is idempotent,
  changes no state, and carries no acceptance meaning; the requirements list
  acceptance — not viewing — as the auditable commercial moment. Per-view events
  would be noisy, unbounded, and would raise a retention question with no
  requirement behind it.

This absence is deliberate and explicit: no "customer viewed the proposal" audit
event exists, and reading a proposal must create no audit event. If the Founder
later wants read receipts or view tracking, that is a separate decision with its
own retention and privacy consequences.

## 10. API and data boundary

The customer read is served through the existing service layer, reusing the
existing authorization and projection patterns. No parallel data-access
architecture is created.

A single customer-safe read path:

1. resolves the project from the customer-visible reference under the existing
   customer project access rules, so authorization is enforced before any read;
2. loads the proposal for that project;
3. selects the current published version, or returns `null` when there is none;
4. maps the version through the customer-safe projection.

Properties the read must satisfy:

- requires a valid customer session;
- enforces project authorization on the server;
- returns only the current published version, never a draft;
- returns `null` (not an error) when no published version exists, so
  "no proposal" and "drafts only" are indistinguishable to the caller;
- performs no mutation of any proposal or project record;
- changes no customer project stage and writes no audit event;
- is not satisfiable through the `founder` internal capability as a substitute
  for customer project access.

No new customer JSON endpoint is added in this slice. Existing customer reads are
server-rendered through the services and only state-changing requests have POST
endpoints; adding a read endpoint would create a new customer data surface
without need. If a JSON read is later required, it must return the same
projection under the same authorization and change no rule above — that is a
later decision, not part of this slice.

## 11. Error and visibility semantics

The slice reuses the platform's existing privacy and error behavior so an
inaccessible resource is indistinguishable from a missing one.

| Situation | Result |
|---|---|
| Unauthenticated request | Existing behavior: redirect to sign-in, preserving `returnTo` |
| Authenticated, project in another organization | `Not found` (404), as today |
| Authenticated, nonexistent/invalid reference | `Not found` (404), as today |
| Authenticated, same organization but no project access (ordinary member without assignment) | `Not found` (404), indistinguishable from a missing project |
| Accessible project, no proposal | Page renders the empty state (no proposal available) |
| Accessible project, only drafts | Same empty state as "no proposal" |
| Accessible project, published version exists | Page renders the published proposal |

Rules:

- The customer must never be able to tell whether an inaccessible project has a
  proposal.
- The empty state must be identical for "no proposal" and "only drafts", so the
  existence of a draft is never implied.
- No error message, status code, or timing difference reveals draft existence.
- Service-level messages shown to a customer must never contain tokens, session
  identifiers, or internal business state, consistent with the existing error
  model.

## 12. Verification contract

Before this slice can be considered complete, focused tests must cover, against
the real services and store:

### Authorization
- an unauthenticated proposal request is rejected;
- an authenticated customer without project access is rejected and shown as not
  found;
- an ordinary member without an explicit project assignment is rejected;
- an ordinary member with an explicit project assignment can read;
- an organization Owner/Admin can read a project in their own organization,
  following the existing project policy;
- an organization Owner/Admin cannot read a proposal in another organization;
- the `founder` internal capability does not grant customer access to another
  organization's project proposal.

### Visibility and version selection
- a proposal with only drafts is not customer-visible;
- a draft version is never returned to a customer;
- a published version is customer-visible;
- when a newer draft exists after a published version, the published version is
  still the one returned;
- when several versions are published, the highest-numbered published version is
  returned and an older published version is not presented as current;
- a proposal is never retrievable through another project's reference.

### Projection boundary
- the customer projection contains only the approved fields;
- internal qualification state, Founder decision, internal notes, internal next
  action, audit metadata, and internal ids never appear in the customer
  projection;
- the projection is built field by field, so an added stored column cannot leak.

### State preservation
- reading a proposal performs no write: it creates no proposal, no version, and
  no publication;
- reading a proposal creates no audit event;
- reading a proposal does not change the customer-facing project stage;
- proposal visibility and publication do not change the customer-facing project
  stage.

### Discoverability signal
- the dashboard signal is `false` when there is no proposal and when only drafts
  exist, and `true` only when a published version exists.

### Error semantics
- a nonexistent or invalid reference follows the existing not-found behavior;
- the empty state for "no proposal" and "only drafts" is identical.

## 13. Non-goals

Not in this slice, and not authorized by it:

- request changes;
- customer acceptance;
- agreement/e-signature;
- payments;
- automatic project activation;
- notifications/email;
- attachments/file storage;
- proposal editing by customers;
- proposal comments/chat;
- proposal templates/library;
- pricing-model redesign;
- analytics;
- deployment/hosting/domain;
- AI/LLM.

Each of these requires its own later, separate Founder decision.

## 14. Acceptance gate

Implementation may proceed only when:

1. this design is Founder-approved;
2. the customer projection excludes every field listed in section 6;
3. customer authorization and the customer project access rules are reused
   unchanged;
4. the authorization, visibility, projection, state-preservation, and error
   tests in section 12 exist;
5. no production or external provider activation is performed without separate
   authorization.

A merged implementation PR does not authorize production deployment or live
customer-data operation.

## 15. Consequences

The platform gains its first customer-facing commercial surface: the customer can
see the actual proposal the Founder published, without any acceptance mechanism
pretending to exist. That closes the gap between "the Founder prepared and
published a proposal" and "the customer can read it".

The cost is one more boundary to keep exact: the customer projection must stay a
strict subset of the published version, and the read must remain free of any
mutation, audit, or stage side effect. That cost is intentional — the proposal is
the first commercial artefact a customer sees, and the smallest safe way to show
it is a read that changes nothing else.

## 16. Alternatives considered

### Advance the customer project stage to *Proposal prepared* on publish
Deferred. It would change the publication semantics fixed by the accepted
Proposal Foundation decision and the existing stage-derivation rule, which is a
separate decision rather than part of making the proposal visible.

### Introduce a second publication concept ("shared with customer")
Rejected. The existing `published` version status already expresses availability;
a second flag would duplicate the Proposal Foundation model and create two
answers to the same question.

### Expose the latest version regardless of publish state
Rejected. It would leak drafts and break the internal boundary the Proposal
Foundation established.

### Expose the internal proposal and version ids
Rejected. They are opaque internal identifiers the customer does not need; the
version number is the customer-meaningful identifier the requirements call for.

### Add request changes and acceptance now
Rejected. Each is a separate capability with its own authorization, evidence,
and legal/commercial questions, and neither is authorized by this document.

### Add a customer JSON read endpoint
Rejected for this slice. Existing customer reads are server-rendered through the
services; a new read endpoint would add a customer data surface without need. It
can be added later under the same projection and authorization.

### Audit every customer proposal view
Rejected. Reading changes nothing and carries no acceptance meaning; the
requirements call for acceptance evidence, not view tracking, and unbounded
view auditing would raise a retention question with no requirement behind it.

### Notify the customer by email when a proposal is published
Rejected. Notifications/email are explicitly out of scope; discoverability is
handled by the dashboard signal instead.

## 17. Approval

**Status: Proposed. Founder approval: Pending.**

This decision is not in force until the Founder explicitly approves it. Approval
of this design would not authorize production deployment, live customer-data
operation, provider activation, or any capability listed in section 13, each of
which requires its own later decision.
