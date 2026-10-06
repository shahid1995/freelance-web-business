# Proposal Foundation

**Status:** Accepted  
**Date:** 2026-10-05  
**Founder approval:** Approved 2026-10-05  
**Scope:** Smallest durable commercial proposal model — one project, one proposal, immutable numbered versions, Founder-only  
**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation, Founder/Internal Workspace and Project Intake Review, Founder Project Queue

> **Status note.** The Founder approved this decision on 2026-10-05. It defines
> the proposal data model, versioning rules, authorization boundary, customer
> boundary, and audit contract for the first proposal slice. It does not authorize
> production deployment, live customer-data processing, email-provider activation,
> hosting or domain changes, agreement/e-signature, payments, or any other external
> action.

## Context

The Founder can now reach a submitted Project Intake and review it. The next
business capability is the commercial proposal that the Founder prepares after a
project is qualified to proceed.

The requirements in `docs/website/customer-platform-requirements.md` anticipate
this as a distinct step: a qualified opportunity becomes a proposal, and the
customer later reviews, requests changes, or accepts it. The proposal templates
in `docs/sales/proposal-templates.md` define the eventual content structure, but
pricing is a separate, unapproved Founder decision, so the commercial baseline
must be capable of being authored without implementing the money side yet.

This decision fixes the smallest durable proposal model, not the whole commercial
workflow. The slice is intentionally smaller than the eventual sales flow: it is
the *foundation* on which later customer review, request-changes, acceptance,
agreement, and payment work can be built.

## Decision

Add a proposal domain, store adapter, internal service, and Founder-only internal
UI for one project → one proposal → immutable numbered versions.

### 1. Scope of the model

A proposal has exactly these parts:

- **one proposal per project**, enforced by the database;
- **stable proposal identity**, separate from the project and from the version;
- **immutable, numbered versions**, oldest first, with version numbers unique
  within the proposal;
- a **version status** of `draft` or `published`;
- timestamps for creation and for publication;
- the **Founder author** of the proposal and of each version;
- a **commercial baseline** big enough to represent the approved proposal template
  structure, all free text, with no amount or currency column;
- the audit metadata necessary to trace who did what, without copying proposal
  content into the audit trail.

### 2. Proposal content

The approved proposal template requires commercial terms to come from
Founder-approved pricing, and pricing is a separate, unapproved Founder decision.
So the proposal content is deliberately all free text and has no amount or
currency column. `commercialTerms` is where the Founder records the terms they
have approved; turning that into structured money is a later decision's job.

A version carries, at minimum:

- `summary`
- `scopeIncluded`
- `scopeExcluded`
- `deliverables`
- `timeline`
- `assumptions`
- `commercialTerms`
- optional `validUntil`, an expiry the Founder chooses for that version

These fields follow the approved proposal template structure rather than
inventing a new one.

A proposal is **authored**, not derived. It is not silently generated from the
Founder qualification state or the Founder decision. The Founder chooses to open
a proposal for a project and then authors versions.

### 3. Versioning rules

Versions are append-only.

- Creating a new version does not mutate historical version content.
- Version numbers are deterministic and unique within the proposal: the next
  number is the proposal's own highest version plus one, falling back to `1` for
  the first version.
- An older version remains readable internally after a newer version exists.
- The system distinguishes the current draft, the current published version, and
  the latest version number.
- Only an explicitly published version can later become a customer-visible
  proposal. The publication step is a separate, explicit, Founder-only, audited
  action.
- There is no delete path for versions.

This slice does not introduce a general-purpose document or versioning framework.
It introduces one append-only version history for one kind of record.

### 4. Status semantics

`draft` and `published` are the only version statuses.

- `draft` is the default and is Founder-only. It never leaves the internal
  workspace.
- `published` records that the Founder explicitly made a version available for the
  future customer workflow. It does **not** mean the customer has seen it,
  accepted it, or agreed to anything.

Proposal/version state is separate from:

- Founder qualification state;
- Founder decision;
- customer-facing project stage;
- future agreement state;
- future payment state.

### 5. Founder authorization

Proposal authoring is Founder-only in this slice.

The slice reuses the existing dedicated `founder` internal capability. It does
**not**:

- infer Founder access from an organization owner/admin role;
- grant proposal privileges through customer membership;
- create a customer-facing authoring route;
- create a new permission subsystem.

A Founder can, in this slice:

- create the initial proposal for an existing project;
- create the next proposal version;
- read existing versions;
- explicitly publish a version.

A customer user must not be able to mutate proposals.

### 6. Customer boundary

For this slice:

- drafts must never appear in customer projections;
- no customer proposal page is added;
- existing customer JSON and API projections stay unchanged;
- internal proposal content must not leak into existing customer endpoints;
- proposal records must not contain authentication or session secrets.

There is no public or customer route merely to prove the proposal exists.

### 7. Auditability

The slice uses the existing audit system and adds only the minimum
proposal-specific events:

- `proposal.created`
- `proposal_version.created`
- `proposal_version.published`

Audit metadata identifies the actor, project, proposal, and version, and relevant
state transitions. It does **not** carry full proposal content. The version
record itself is the content's home.

### 8. Data access and persistence

The slice uses the existing PlatformStore and SQLite architecture. It adds two
tables:

- `proposals` — one row per project, with `project_id` unique;
- `proposal_versions` — append-only version rows, with `(proposal_id,
  version_number)` unique, a CHECK constraint on status, content stored once, and
  no delete path.

No existing project or customer table is modified for the proposal relationship.
Project lookup for proposal creation uses the existing global reference rules, so
a proposal is bound to exactly one project.

### 9. Internal service boundary

The slice adds `ProposalService` behind the existing internal service patterns.
It reuses, and does not duplicate:

- Founder authorization;
- project lookup;
- the audit append path through the store port;
- transaction handling.

Business rules live in the service, not in a Next.js page.

The service is wired into the platform container so it is reachable from the
internal route tree.

### 10. Internal UI

Add a Founder-only proposal surface under `/internal/projects/{reference}/proposal`.

In this slice, the Founder can:

- see whether a project has a proposal;
- view existing proposal versions, oldest first;
- create the initial draft where there is none;
- create the next version through explicit version creation;
- explicitly publish a version for the future customer workflow.

The first UI is simple and reuses the existing Founders workspace visual pattern.
It is **not** a customer page, not a discussion/chat UI, and not a payment or
agreement surface.

### 11. Project relationship

Proposal creation requires an existing project.

A proposal cannot be created for a nonexistent reference. The existing global
project reference rules apply. A proposal stays associated with exactly one
project and must never be retrievable through another project's reference.

### 12. State separation

Creating or editing a proposal must **not** silently move the customer-facing
project stage.

Publishing a proposal in this slice must **not** mean the customer accepted it.

The project is not automatically activated.

## Verification contract

Before this slice can be considered complete, focused tests must cover, against
the real services and store:

### Authorization
- an unauthenticated proposal access is rejected;
- a customer session is rejected;
- an organization owner/admin without the Founder capability is rejected;
- a Founder can create a proposal for an existing project;
- a proposal cannot be attached to a nonexistent project.

### Versioning
- the initial version is created correctly;
- historical version content remains unchanged after a later version is created;
- version numbering is deterministic;
- drafts remain internal;
- published/available status is explicit and server-authorized.

### Customer boundary
- customer projections contain no proposal draft or internal proposal fields;
- proposal creation or update does not change the customer-facing project stage;
- one project's proposal cannot be retrieved through another project's reference;
- customer project access rules remain unchanged.

### Audit
- audit events are generated for material proposal actions;
- audit metadata does not contain full proposal content;
- historical versions remain readable.

### Data integrity
- malformed or unsupported proposal status values are rejected server-side.

## Non-goals

Not in this slice:

- customer proposal review;
- request-changes workflow;
- proposal acceptance;
- agreement/e-signature;
- payments;
- automatic project activation;
- notifications/email;
- file attachments;
- AI/LLM;
- proposal templates/library;
- analytics;
- deployment.

Each of these requires a later, separate Founder decision.

## Acceptance gate

Implementation may proceed only when:

1. this design is Founder-approved;
2. the versioning, authorization, customer-boundary, and audit rules above are
   implemented and regression-tested against real services and store;
3. customer projections and customer project access rules remain unchanged;
4. no production or external provider activation is performed without separate
   authorization.

A merged implementation PR does not authorize production deployment or live
customer-data operation.

## Consequences

The platform gains a durable, auditable, Founder-controlled proposal record that
is ready for the later commercial workflow without pretending that workflow
already exists.

The cost is another Founder-only surface to keep separate from the customer
workspace, and another append-only history to preserve. That cost is intentional:
the proposal is the first durable commercial artefact after qualification, and the
slice should model that durability correctly instead of papering over it.

## Alternatives considered

### Derive the proposal from the Founder decision or qualification state
Rejected. The proposal is authored commercial content, not a mechanical
translation of internal assessment. Deriving it would make the proposal pretend to
say something the Founder has not actually written.

### Introduce amounts, currency, or a pricing field now
Rejected. Pricing is a separate, unapproved Founder decision. Adding a money
column now would either pre-empt that decision or sit unused, and would
contradict the approved template rule that commercial amounts come from
Founder-approved pricing.

### Make versions mutable with overwrites
Rejected. Immutability is the point of the model. Overwriting content would
destroy the record of what the Founder committed to at a point in time.

### Add a delete path for old versions
Rejected. The repository does not have a standing requirement to delete historical
proposal content, and the value of the model depends on history being preserved.

### Expose proposals to customers in this slice
Rejected. The slice is the foundation, not the full customer review/acceptance
flow. Exposing drafts or publication state now would conflate foundation with a
customer workflow that is deferred.

### Put proposal content into the audit trail
Rejected. The version record is the content home. Duplicating large commercial
text into unbounded audit metadata would create a second copy and a second
retention question.

## Approval

**Status: Accepted. Founder approval: Approved 2026-10-05.**

The Founder approved this slice on 2026-10-05. Approval of this design does not
authorize production deployment, live customer-data operation, or provider
activation.
