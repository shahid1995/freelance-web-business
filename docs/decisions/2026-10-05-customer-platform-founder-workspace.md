# Founder/Internal Workspace and Project Intake Review

**Status:** Proposed  
**Date:** 2026-10-05  
**Founder approval:** Pending  
**Scope:** Design gate for the next customer-platform implementation slice  
**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation

> **Status note.** This is a design proposal, not an approved or implemented
> decision. Implementation of this slice **cannot proceed until the Founder
> approves this document**. Approving it does not authorize deployment, live
> customer-data processing, email-provider activation, hosting or domain
> changes, or any other external action.

## Context

The first customer-platform vertical slice — passwordless customer identity →
organization creation → customer dashboard → project creation → saved Project
Intake — is implemented and merged (PR #35), and the foundation it rests on is
recorded as an accepted decision in
`docs/decisions/2026-10-04-customer-platform-foundation.md`. That slice is not
deployed or activated for live customers.

The customer journey now has a real stopping point. A customer can submit
Project Intake, and the customer-facing stage advances to **Project Intake —
Information submitted**. Nothing then happens on the server: there is no
internal capability to review the submission, and no defined customer-facing
next step.

The requirements in `docs/website/customer-platform-requirements.md` anticipate
this gap:

- section 7 defines **Project Intake — Review** as the next customer-facing
  timeline stage after information is submitted, and states that the UI must
  separate customer-facing status from internal operational state;
- section 7 lists internal qualification outcomes (**Qualified**,
  **Clarification required**, **Not a fit**, **No decision**) that are
  explicitly not customer-facing copy;
- section 11 defines an eventual Founder/internal workspace with Founder-only
  initial access.

The foundation decision also reserved internal-only project fields —
qualification state, internal notes, Founder decision, and internal next action
— precisely so the Founder workspace would own them later, without ever
exposing them to customers.

This document defines the *minimum* server-authoritative internal capability
needed after a customer submits Project Intake and before any proposal or
commercial workflow begins. It is a design gate: it fixes boundaries and the
verification contract so implementation can be small, reviewable, and safe.

## Decision

Add a Founder-only internal workspace that lets the Founder review a submitted
Project Intake and record an internal decision, using the server-authoritative
foundation already in place. Concretely:

1. The internal workspace is a separate surface from the customer workspace.
2. Every internal read and write is authorized on the server; Founder-only at
   first.
3. The Founder can see the organization, customer identity, project, submitted
   Project Intake, the customer-facing project stage, and relevant audit
   history.
4. Internal qualification state, internal notes, the Founder decision, and the
   internal next action remain internal-only fields.
5. The slice defines a minimal review lifecycle and distinguishes
   customer-facing state, internal qualification state, and future
   proposal/commercial state.
6. The approved organization/project access model is preserved; Founder access
   is a distinct capability and must never be treated as customer access.
7. A defined set of internal actions creates audit events.
8. An explicit customer boundary states what customers must never receive from
   the internal workspace.

## 1. Workspace separation

Customer and internal surfaces are separate route trees and separate
authorization paths. They must not be reachable from one another by changing a
URL, a query parameter, or a request body.

- **Customer workspace** — the existing surfaces (`/sign-in`,
  `/onboarding/organization`, `/dashboard`,
  `/dashboard/projects/{reference}/intake`) and their endpoints, authorized by
  organization membership and project access.
- **Internal workspace** — a distinct, Founder-only surface (for example under
  an `/internal/...` route prefix and matching `/api/internal/...` endpoints)
  listed separately in routing and never linked from customer UI.

The internal workspace is not a customer route with hidden controls. It has its
own page components and its own request handlers, so a customer session can
never satisfy an internal request by construction, and an internal page is never
rendered inside the customer shell.

The names, URLs, and prefixes chosen here are indicative; the binding rule is
the separation of route trees, request handlers, and authorization paths.

## 2. Internal access and authorization

- **Founder-only initially.** The first version of the internal workspace is
  accessible only to the Founder. It must be structured so that future staff
  roles or controlled automation identities can be added later without changing
  the customer boundary, but no such role is added in this slice.
- **Server-authoritative on every operation.** Every internal read and write is
  authorized on the server, in the same request-guard style already used for
  customer operations (session requirement plus origin check on state-changing
  requests). Internal authorization is never enforced only by hiding UI.
- **Explicit capability, not membership.** Founder access is an explicitly
  granted, server-checked capability. It is not derived from an organization
  membership role, and it is not implied by being the creator of a project or
  organization. A Founder identity must not be modeled as a customer owner or
  member of arbitrary organizations.
- **Customer requests get no internal data.** No internal field is added to any
  existing customer response; the customer projections in
  `website/lib/platform/views.ts` stay field-by-field, and internal types stay
  unconsumed by customer responses.

Design question resolved: internal access is deliberately *not* added to the
customer authorization matrix. It is a separate check that runs before any
customer access rule, so it can never be accidentally relaxed into customer
access.

## 3. Project review

For a project whose Project Intake has been submitted, the Founder can see:

- the **organization** (name and reference);
- the **customer identity** (the people associated with the project, with their
  membership role);
- the **project** (reference, title, created and updated timestamps);
- the **submitted Project Intake** (all submitted fields, with the intake
  schema version and submission timestamp);
- the **customer-facing project stage** (the customer-safe label only, e.g.
  *Project Intake — Information submitted*);
- **relevant audit history** for the project, organization, and its customer
  actions (for example the existing sign-in, organization-created,
  project-created, Project Intake saved, and Project Intake submitted events).

The review view reads through the existing server-side data access layer. It
does not read the public content model, and it does not introduce a second data
store or provider.

## 4. Internal-only state

The internal workspace owns these fields on the project record. They are
internal by construction and must not be serialized into any customer response:

- **qualification state** — initially `unreviewed`, transitioning to one of
  `qualified`, `clarification_required`, `not_a_fit`, or `no_decision`;
- **internal notes** — free-text working notes;
- **Founder decision** — the recorded internal decision for the project;
- **internal next action** — the next internal step the Founder intends to take.

These already exist as internal-only fields reserved by the foundation
decision. This slice gives them a real internal surface and a real owner; it
does not expose them.

## 5. Review workflow

The minimum lifecycle is:

**Project Intake submitted → Founder review → internal decision →
customer-facing next step**

Three layers of state are distinguished explicitly and must not be conflated:

- **Customer-facing state** — the approved customer timeline stages from the
  requirements document. In this slice the relevant transitions are *Project
  Intake — Information submitted* → *Project Intake — Review*, and then the
  customer-safe next step the Founder chooses to publish. Customer-visible
  labels come only from the approved customer vocabulary.
- **Internal qualification state** — `unreviewed`, `qualified`,
  `clarification_required`, `not_a_fit`, `no_decision`. Never customer-facing.
- **Future proposal/commercial state** — proposal prepared, proposal accepted,
  agreement completed, payment satisfied. In scope only as reserved customer
  stages; **no commercial workflow is implemented or decided here**.

The minimum review actions are:

1. **Open review.** The Founder opens a submitted Project Intake; the customer
   stage may advance to *Project Intake — Review*.
2. **Review.** The Founder records internal notes as needed and changes the
   qualification state.
3. **Internal decision.** The Founder records a decision and the next internal
   action.
4. **Customer-facing next step.** The Founder advances the customer to the
   appropriate customer-safe stage within the already-approved vocabulary (for
   example *Requirements confirmed*, or *Project Intake — Review* still in
   progress). No new customer-facing stage is invented by this slice.

This document intentionally does **not** define the final commercial path,
proposal content, pricing, or acceptance. Those remain later decisions.

## 6. Access model preservation

The organization/project access rules in the foundation decision are unchanged:

- Owner/Admin of an organization have organization-wide access to its projects.
- Ordinary members see only projects explicitly assigned to them.
- Removing an assignment removes access immediately.
- Membership in one project never implies access to another.

Founder access is an additional, separate capability layered above these rules.
It must not change them. In particular:

- Founder access must not make the Founder a member, owner, or admin of a
  customer organization;
- Founder access must not be visible to customers as membership or access;
- internal views must not become a path by which a customer gains access to
  another organization's projects.

## 7. Auditability

Internal actions create audit events so the internal history is reconstructable.
At minimum, the following create audit events:

- **reviewing intake** — recording that the Founder reviewed a submitted
  Project Intake (for example `project_intake.reviewed`);
- **changing qualification state** — recording the new state
  (`project.qualification_changed`);
- **adding or updating internal notes** — recording that notes changed, without
  duplicating note contents into the customer-visible surface
  (`project.internal_note_added`, `project.internal_note_updated`);
- **recording a Founder decision** — recording that a decision was made
  (`project.founder_decision_recorded`);
- **recording the next internal action**
  (`project.internal_next_action_recorded`).

Advancing the customer-facing stage is also an audited action
(`project.customer_stage_changed`), because customer-visible state changed.

Event types follow the existing `AuditEventType` convention. Audit events
record that an internal action happened; they do not, by themselves, become
customer-visible history. Exact retention, storage, and any export policy are
**out of scope** for this slice and remain a later security decision.

## 8. Customer boundary

Customers must never receive, from the internal workspace:

- qualification state or any internal qualification label;
- internal notes;
- the Founder decision;
- the internal next action;
- internal audit metadata or internal-only audit events;
- Founder identity, internal access lists, or internal role information;
- any internal field merely because it exists on the project record.

Only deliberately shaped, customer-safe projections may leave the server for a
customer request. Internal state changes never appear in a customer response
unless a separate, Founder-approved decision exposes an explicitly safe
projection.

## 9. Use of the existing foundation

This slice adds no new architectural category:

- it uses the same provider-neutral domain, store port, and email port already
  in place; no database or email dependency is added and no provider is
  activated;
- it relies on the existing session and origin-check request guard;
- it keeps customer projections field-by-field;
- it introduces no payment, file-storage, AI/LLM, or analytics capability.

## 10. Verification contract

Before this slice can be considered complete, tests must cover at least:

### Internal access
- an internal operation without a valid session is rejected;
- a valid customer session cannot reach an internal operation or page;
- an internal state-changing request without a valid origin is rejected;
- internal authorization is enforced server-side, not by hidden UI.

### Review
- the Founder can read organization, customer identity, project, submitted
  Project Intake, customer-facing stage, and relevant audit history for a
  submitted project;
- review is available only for a submitted Project Intake, not an unrelated or
  unsubmitted project;
- recording a qualification change, a decision, and a next action persists to
  the same project.

### State separation
- internal qualification, notes, decision, and next action never appear in any
  customer response;
- customer-facing labels come only from the approved customer vocabulary;
- changing internal state does not change customer-visible state unless the
  Founder explicitly advances the customer-facing stage.

### Access preservation
- Founder access does not alter organization membership or project access for
  any customer;
- existing organization/project access rules continue to pass unchanged;
- existing customer features continue to pass unchanged.

### Audit
- each internal action defined in section 7 records an audit event;
- audit events do not leak into customer responses.

## 11. Non-goals

Do not include in this slice:

- proposal generation;
- proposal acceptance;
- agreements/e-signature;
- payments;
- delivery onboarding;
- AI/LLM;
- live email-provider activation;
- deployment;
- analytics;
- file storage;
- customer chat.

Each of these requires a later, separate Founder decision.

## 12. Acceptance gate

Implementation may proceed only when:

1. this design is Founder-approved;
2. the internal route/endpoint surface is documented and reviewed;
3. server-side internal-authorization tests exist;
4. the state-separation tests in section 10 exist;
5. no production or external provider activation is performed without separate
   authorization.

A merged implementation PR does not authorize production deployment or live
customer-data operation.

## Consequences

The slice closes the current gap between *Project Intake submitted* and any
internal action, using boundaries that already exist. It gives the Founder a
real, auditable place to qualify a project while keeping the customer-facing
experience limited to the approved vocabulary.

The main cost is another authorization path to design and test, and a second
surface to keep free of customer reachability. That cost is intentional:
internal qualification state must be owned somewhere, and building it on the
existing server-authoritative foundation is safer than deriving it inside the
customer workspace.

## Alternatives considered

### Add hidden internal controls to customer pages
Rejected. It would place internal state inside the customer workspace, invite
accidental exposure, and make "internal" a matter of UI visibility rather than
of server authorization.

### Model the Founder as an owner/admin member of every organization
Rejected. It would blur the customer/membership boundary and could not prevent
Founder access from becoming ordinary customer access.

### Derive the customer-facing stage purely from internal qualification state
Rejected. Internal outcomes such as *Qualified* or *Not a fit* are explicitly
not customer-facing copy, and the requirements require the two states to be
separate.

### Combine this with the proposal/commercial workflow
Rejected. The proposal and commercial path is a later decision and would expand
this slice far beyond the minimum internal capability needed after submission.

### Add a new provider or data store for internal operations
Rejected. The existing provider-neutral foundation is sufficient, and provider
selection and activation remain separate decisions.

## Approval

**Status: Proposed. Founder approval: Pending.**

Implementation cannot proceed until the Founder approves this document. Before
approval, the following should be confirmed or adjusted by the Founder:

- the internal route/endpoint surface and its separation from customer routes;
- the initial Founder-only access mechanism;
- the exact internal action set that records audit events (section 7);
- whether the customer-facing stage advances to *Project Intake — Review* when
  the Founder opens review.
