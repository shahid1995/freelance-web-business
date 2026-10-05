# Founder/Internal Workspace and Project Intake Review

**Status:** Accepted  
**Date:** 2026-10-05  
**Founder approval:** Approved 2026-10-05  
**Scope:** Design gate for the next customer-platform implementation slice  
**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation

> **Status note.** The Founder approved this decision on 2026-10-05. It is now
> the governing design for the next customer-platform slice. Approval does not
> authorize production deployment, live customer-data processing,
> email-provider activation, hosting or domain changes, or any other external
> action; those remain separately governed.

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
2. Every internal read and write is authorized on the server against a
   dedicated internal capability attached to a Person, conceptually `founder`
   in the first version.
3. The Founder can see the organization, customer identity, project, submitted
   Project Intake, the customer-facing project stage, and relevant audit
   history.
4. Internal qualification state, internal notes, the Founder decision, and the
   internal next action remain internal-only fields.
5. The slice defines a minimal review lifecycle in which opening a review is
   read-only and an explicit Founder action starts it, and distinguishes
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

### 2.1 The internal capability

Founder access is a **dedicated server-side internal capability attached to a
Person**. It is conceptually a single capability named `founder` in the first
version. It is deliberately *not* a customer role, a membership role, or a
field on any customer-facing record.

Properties:

- **Server-checked on every internal operation.** Every internal read and write
  is authorized on the server, in the same request-guard style already used for
  customer operations (session requirement plus origin check on state-changing
  requests). Internal authorization is never enforced only by hiding UI.
- **Independent of organization membership.** The capability is never inferred
  from an organization owner/admin membership, from being the creator of a
  project or organization, or from any other customer-role signal. A Founder
  identity must not be modeled as a customer owner or member of arbitrary
  organizations.
- **Never granted through customer-facing UI.** No customer page, control,
  endpoint, or invitation flow can assign, change, or revoke the capability.
  Customer endpoints reject it entirely.
- **Assigned only through controlled server-side bootstrap/configuration.**
  Initial assignment happens through a controlled, server-side bootstrap or
  configuration step, in the same spirit as the existing server-side
  configuration boundary. This ADR fixes the *properties* of that mechanism —
  it is server-side, controlled, and provider-neutral — and deliberately does
  not specify a production deployment mechanism, an environment activation
  step, or any external action. Selecting and authorizing any production
  arrangement remains a separate Founder decision.
- **Extensible without touching customer authorization.** Later staff roles or
  controlled automation identities may be added as additional internal
  capabilities. The customer authorization model does not change, because
  internal capabilities are a separate concept checked before any customer
  rule.
- **Invisible to customers.** Customer APIs and customer projections never
  expose internal capability or internal role information. No customer
  response reveals whether a person has internal access.

### 2.2 Relationship to the customer workspace

Design question resolved: internal access is deliberately *not* added to the
customer authorization matrix. It is a separate check that runs before any
customer access rule, so it can never be accidentally relaxed into customer
access.

No internal field is added to any existing customer response; the customer
projections in `website/lib/platform/views.ts` stay field-by-field, and internal
types stay unconsumed by customer responses.

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
- **Founder decision** — the recorded internal decision for the project, drawn
  from the bounded vocabulary in section 4.2;
- **internal next action** — the next internal step the Founder intends to take.

These already exist as internal-only fields reserved by the foundation
decision. This slice gives them a real internal surface and a real owner; it
does not expose them.

### 4.1 Qualification state and Founder decision are different facts

They are recorded independently and must not be treated as one field.

- **Qualification state** describes the internal *assessment*: what the Founder
  concludes about the project's fit.
- **Founder decision** records the operational *action* taken after review:
  what the Founder decides to do next.
- Neither is customer-facing, and neither is derived from the other. Sharing a
  label such as `clarification_required` across both vocabularies does not make
  them one field; the two are stored and audited separately.
- `hold` exists so that pausing is an explicit decision rather than a project
  that silently stays undecided.

### 4.2 Founder decision vocabulary

The Founder decision uses a bounded vocabulary. Exactly these values are valid:

| Value | Meaning |
|---|---|
| `proceed` | Review is complete and the Founder proceeds to the next internal step. |
| `clarification_required` | The Founder needs more information before deciding. |
| `not_a_fit` | The Founder decides the project is not a fit. |
| `hold` | The Founder explicitly pauses the project pending new information or capacity. |

Any value outside this vocabulary is invalid and is rejected server-side; it is
never silently stored or coerced. `hold` is a real recorded decision, not an
absent one.

No automatic mapping between qualification state and Founder decision is
required by this slice. Each is set by its own explicit Founder action.

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

Opening or viewing a submitted Project Intake is **read-only**. Loading the
Founder review page must not change the customer-facing project stage, the
qualification state, or any other project field. There is no implicit side
effect in reading.

The minimum review actions are:

1. **Start Review (explicit).** A deliberate Founder action that begins review of
   a submitted Project Intake. Only this action may transition the
   customer-facing stage from *Project Intake — Information submitted* to
   *Project Intake — Review*. It is authorized on the server as an internal
   operation and creates an audit event.
2. **Review.** The Founder records internal notes as needed and changes the
   qualification state.
3. **Internal decision.** The Founder records a Founder decision and the next
   internal action.
4. **Customer-facing next step.** The Founder advances the customer to the
   appropriate customer-safe stage within the already-approved vocabulary (for
   example *Requirements confirmed*). No new customer-facing stage is invented
   by this slice.

State separation is unaffected by the Start Review action: starting review
moves the customer-facing stage only. It does not apply, imply, or derive any
internal qualification state, and changing qualification state never moves the
customer-facing stage on its own. The two remain separate, explicitly recorded
facts.

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

- **starting review** — recording the explicit Start Review action on a
  submitted Project Intake (`project_intake.review_started`). Opening or
  viewing a review is read-only and changes no project state, so it records no
  review audit event;
- **changing qualification state** — recording the new state
  (`project.qualification_changed`);
- **adding or updating internal notes** — recording that notes changed, without
  duplicating note contents into the customer-visible surface
  (`project.internal_note_added`, `project.internal_note_updated`);
- **recording a Founder decision** — recording that a decision was made
  (`project.founder_decision_recorded`);
- **recording the next internal action**
  (`project.internal_next_action_recorded`).

Advancing the customer-facing stage — including the Start Review transition —
is also an audited action (`project.customer_stage_changed`), because
customer-visible state changed.

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
- a valid customer session without the internal capability is rejected, even
  when that person is an organization owner/admin of a customer organization;
- an internal state-changing request without a valid origin is rejected;
- internal authorization is enforced server-side, not by hidden UI;
- the internal capability cannot be granted, changed, or revoked through any
  customer-facing page or customer endpoint;
- customer responses never expose the internal capability, the internal role
  list, or whether a person has internal access.

### Review
- the Founder can read organization, customer identity, project, submitted
  Project Intake, customer-facing stage, and relevant audit history for a
  submitted project;
- review is available only for a submitted Project Intake, not an unrelated or
  unsubmitted project;
- **merely opening or reading the review page does not mutate the customer-facing
  stage** or any other project field;
- the explicit Start Review action performs the authorized transition from
  *Project Intake — Information submitted* to *Project Intake — Review* and
  records its audit event;
- the Start Review transition is rejected without the internal capability and
  rejected without a valid origin;
- recording a qualification change, a decision, and a next action persists to
  the same project;
- a qualification change on its own does not move the customer-facing stage.

### State separation
- internal qualification, notes, decision, and next action never appear in any
  customer response;
- customer-facing labels come only from the approved customer vocabulary;
- changing internal state does not change customer-visible state unless the
  Founder explicitly advances the customer-facing stage.

### Founder decision vocabulary
- only `proceed`, `clarification_required`, `not_a_fit`, and `hold` are accepted
  as a Founder decision;
- an unknown or empty decision value is rejected server-side and not stored;
- a recorded Founder decision never appears in any customer response;
- a Founder decision of `hold` is stored as an explicit pause and is
  distinguishable from a project with no decision recorded.

### Access preservation
- Founder access does not alter organization membership or project access for
  any customer;
- existing organization/project access rules continue to pass unchanged;
- existing customer features continue to pass unchanged.

### Audit
- each internal action defined in section 7 records an audit event;
- the Start Review action records both its review-start event and the
  customer-stage change it causes;
- opening or viewing a review records no project-state audit event;
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
3. the internal capability model in section 2 — including the properties of the
   bootstrap/configuration mechanism and its provider-neutrality — is
   Founder-reviewed;
4. server-side internal-authorization tests exist;
5. the state-separation and Founder-decision-vocabulary tests in section 10
   exist;
6. no production or external provider activation is performed without separate
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

### Advance the customer-facing stage implicitly when review is opened
Rejected. Reading a page must not change what a customer sees. The transition to
*Project Intake — Review* is an explicit, server-authorized, audited Founder
action, not a side effect of navigation.

### Combine this with the proposal/commercial workflow
Rejected. The proposal and commercial path is a later decision and would expand
this slice far beyond the minimum internal capability needed after submission.

### Add a new provider or data store for internal operations
Rejected. The existing provider-neutral foundation is sufficient, and provider
selection and activation remain separate decisions.

## Approval

**Status: Accepted. Founder approval: Approved 2026-10-05.**

The Founder approved this decision on 2026-10-05. It is now the governing design
for the Founder/internal workspace and Project Intake review slice, approved as
written, including:

- the internal route/endpoint surface and its separation from customer routes;
- the internal capability model, and the controlled bootstrap/configuration
  mechanism by which the initial `founder` capability is assigned (section 2);
- the exact internal action set that records audit events (section 7);
- the Founder decision vocabulary (section 4.2);
- the customer-facing stage advancing to *Project Intake — Review* only through
  the explicit, audited **Start Review** action, never as a side effect of
  opening or viewing a review.

Approval of this design does not authorize production deployment, live
customer-data operation, or provider activation.
